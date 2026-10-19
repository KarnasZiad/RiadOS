import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeCursor, encodeCursor } from '../../common/cursor';
import { LockNotAcquiredError, RedisLock } from '../../infrastructure/redis/redis-lock.service';
import { FakeRedis } from '../../testing/fake-redis';
import { FakeTenantDb } from '../../testing/fake-tenant-db';
import type { AuthUser } from '../auth/auth.types';
import { NO_OVERLAP_CONSTRAINT, ReservationsService } from './reservations.service';
import { z } from 'zod';

const reception: AuthUser = { userId: randomUUID(), tenantId: randomUUID(), role: 'RECEPTION' };
const room = {
  id: randomUUID(),
  tenantId: reception.tenantId,
  name: 'Atlas',
  capacity: 3,
  baseRateCents: 85_000,
  isActive: true,
};
const guest = { id: randomUUID(), fullName: 'Sara El Idrissi' };

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    tenantId: reception.tenantId,
    roomId: room.id,
    guestId: guest.id,
    checkIn: new Date('2026-10-20T00:00:00Z'),
    checkOut: new Date('2026-10-23T00:00:00Z'),
    status: 'CONFIRMED',
    source: 'DIRECT',
    adults: 2,
    children: 0,
    totalCents: 255_000,
    currency: 'MAD',
    notes: null,
    createdById: reception.userId,
    createdAt: new Date('2026-10-19T10:00:00Z'),
    updatedAt: new Date('2026-10-19T10:00:00Z'),
    room: { id: room.id, name: room.name },
    guest,
    ...overrides,
  };
}

const input = {
  roomId: room.id,
  checkIn: '2026-10-20',
  checkOut: '2026-10-23',
  adults: 2,
  children: 0,
  guest: { fullName: 'Sara El Idrissi', email: 'sara@example.com' },
};

function serializationFailure() {
  return new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', {
    code: 'P2034',
    clientVersion: 'test',
  });
}

describe('ReservationsService', () => {
  let tx: {
    room: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    tenant: { findUniqueOrThrow: ReturnType<typeof vi.fn> };
    guest: { create: ReturnType<typeof vi.fn> };
    reservation: {
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let db: FakeTenantDb;
  let redis: FakeRedis;
  let service: ReservationsService;

  beforeEach(() => {
    tx = {
      room: { findFirst: vi.fn().mockResolvedValue(room), findMany: vi.fn() },
      tenant: { findUniqueOrThrow: vi.fn().mockResolvedValue({ currency: 'MAD' }) },
      guest: { create: vi.fn().mockResolvedValue(guest) },
      reservation: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue(record()),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };
    db = new FakeTenantDb(tx);
    redis = new FakeRedis();
    service = new ReservationsService(db.asTenantDb(), new RedisLock(redis.asRedis()));
  });

  describe('create', () => {
    it('books the room in a SERIALIZABLE transaction with a server-side price', async () => {
      const view = await service.create(reception, input);

      expect(db.calls).toEqual([{ tenantId: reception.tenantId, isolationLevel: 'Serializable' }]);
      expect(tx.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: reception.tenantId,
            roomId: room.id,
            guestId: guest.id,
            checkIn: new Date('2026-10-20T00:00:00Z'),
            checkOut: new Date('2026-10-23T00:00:00Z'),
            totalCents: 3 * 85_000,
            currency: 'MAD',
            createdById: reception.userId,
          }) as unknown,
        }),
      );
      expect(view).toMatchObject({
        room: { id: room.id, name: 'Atlas' },
        checkIn: '2026-10-20',
        checkOut: '2026-10-23',
        nights: 3,
        totalCents: 255_000,
      });
      expect(view).not.toHaveProperty('tenantId');
    });

    it('releases the room lock once the reservation is stored', async () => {
      await service.create(reception, input);

      expect(redis.get(`riados:lock:${reception.tenantId}:room:${room.id}`)).toBeUndefined();
    });

    it('checks overlaps on active reservations only, with half-open ranges', async () => {
      await service.create(reception, input);

      expect(tx.reservation.count).toHaveBeenCalledWith({
        where: {
          tenantId: reception.tenantId,
          roomId: room.id,
          status: { not: 'CANCELLED' },
          checkIn: { lt: new Date('2026-10-23T00:00:00Z') },
          checkOut: { gt: new Date('2026-10-20T00:00:00Z') },
        },
      });
    });

    it('refuses overlapping nights', async () => {
      tx.reservation.count.mockResolvedValue(1);

      await expect(service.create(reception, input)).rejects.toBeInstanceOf(ConflictException);
      expect(tx.reservation.create).not.toHaveBeenCalled();
    });

    it('maps the database exclusion constraint to a conflict', async () => {
      tx.reservation.create.mockRejectedValue(
        new Error(`violates exclusion constraint "${NO_OVERLAP_CONSTRAINT}"`),
      );

      await expect(service.create(reception, input)).rejects.toThrow(
        'This room is already booked for some of these nights',
      );
    });

    it('replays the transaction after a serialization failure', async () => {
      db.failNextWith(serializationFailure());

      await expect(service.create(reception, input)).resolves.toMatchObject({ nights: 3 });
      expect(db.calls).toHaveLength(2);
    });

    it('answers with a conflict when the room lock stays busy', async () => {
      const busyLock = {
        withLock: vi.fn().mockRejectedValue(new LockNotAcquiredError('room')),
      } as unknown as RedisLock;
      service = new ReservationsService(db.asTenantDb(), busyLock);

      await expect(service.create(reception, input)).rejects.toThrow(
        'This room is being booked right now, please try again',
      );
    });

    it('rejects invalid dates before touching the database', async () => {
      await expect(
        service.create(reception, { ...input, checkOut: input.checkIn }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.calls).toHaveLength(0);
    });

    it('enforces the room capacity', async () => {
      await expect(
        service.create(reception, { ...input, adults: 3, children: 1 }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('returns 404 for a room outside the tenant', async () => {
      tx.room.findFirst.mockResolvedValue(null);

      await expect(service.create(reception, input)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('cancels a confirmed reservation', async () => {
      tx.reservation.findFirst.mockResolvedValue(record());
      tx.reservation.update.mockResolvedValue(record({ status: 'CANCELLED' }));

      await expect(service.cancel(reception, randomUUID())).resolves.toMatchObject({
        status: 'CANCELLED',
      });
      expect(tx.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'CANCELLED' } }),
      );
    });

    it('is idempotent', async () => {
      tx.reservation.findFirst.mockResolvedValue(record({ status: 'CANCELLED' }));

      await expect(service.cancel(reception, randomUUID())).resolves.toMatchObject({
        status: 'CANCELLED',
      });
      expect(tx.reservation.update).not.toHaveBeenCalled();
    });

    it('refuses to cancel a completed stay', async () => {
      tx.reservation.findFirst.mockResolvedValue(record({ status: 'CHECKED_OUT' }));

      await expect(service.cancel(reception, randomUUID())).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('returns 404 for an unknown reservation', async () => {
      tx.reservation.findFirst.mockResolvedValue(null);

      await expect(service.cancel(reception, randomUUID())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('list', () => {
    const query = { from: '2026-10-01', to: '2026-11-01', limit: 2 };
    const CursorSchema = z.object({ checkIn: z.string(), id: z.string() });

    it('returns a page and a cursor when more rows exist', async () => {
      const rows = [
        record({
          checkIn: new Date('2026-10-02T00:00:00Z'),
          checkOut: new Date('2026-10-04T00:00:00Z'),
        }),
        record({
          checkIn: new Date('2026-10-05T00:00:00Z'),
          checkOut: new Date('2026-10-06T00:00:00Z'),
        }),
        record({
          checkIn: new Date('2026-10-07T00:00:00Z'),
          checkOut: new Date('2026-10-08T00:00:00Z'),
        }),
      ];
      tx.reservation.findMany.mockResolvedValue(rows);

      const page = await service.list(reception, query);

      expect(page.items).toHaveLength(2);
      expect(decodeCursor(page.nextCursor ?? '', CursorSchema)).toEqual({
        checkIn: '2026-10-05',
        id: rows[1]?.id,
      });
      expect(tx.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3, orderBy: [{ checkIn: 'asc' }, { id: 'asc' }] }),
      );
    });

    it('returns no cursor on the last page', async () => {
      tx.reservation.findMany.mockResolvedValue([record()]);

      await expect(service.list(reception, query)).resolves.toMatchObject({ nextCursor: null });
    });

    it('continues after the cursor with a keyset condition', async () => {
      tx.reservation.findMany.mockResolvedValue([]);
      const id = randomUUID();

      await service.list(reception, {
        ...query,
        cursor: encodeCursor({ checkIn: '2026-10-05', id }),
      });

      expect(tx.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { checkIn: { gt: new Date('2026-10-05') } },
              { checkIn: new Date('2026-10-05'), id: { gt: id } },
            ],
          }) as unknown,
        }),
      );
    });

    it('rejects a tampered cursor', async () => {
      await expect(
        service.list(reception, { ...query, cursor: encodeCursor({ checkIn: 'x', id: 'y' }) }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('availability', () => {
    it('groups the reservations of the period by room', async () => {
      const other = { id: randomUUID(), name: 'Toubkal', capacity: 2 };
      tx.room.findMany.mockResolvedValue([{ id: room.id, name: room.name, capacity: 3 }, other]);
      tx.reservation.findMany.mockResolvedValue([
        {
          id: 'r1',
          roomId: room.id,
          checkIn: new Date('2026-10-20T00:00:00Z'),
          checkOut: new Date('2026-10-22T00:00:00Z'),
          status: 'CONFIRMED',
          guest: { fullName: 'Sara El Idrissi' },
        },
      ]);

      const view = await service.availability(reception, { from: '2026-10-19', to: '2026-11-02' });

      expect(view.rooms).toEqual([
        {
          id: room.id,
          name: 'Atlas',
          capacity: 3,
          reservations: [
            {
              id: 'r1',
              guestName: 'Sara El Idrissi',
              checkIn: '2026-10-20',
              checkOut: '2026-10-22',
              status: 'CONFIRMED',
            },
          ],
        },
        { ...other, reservations: [] },
      ]);
    });

    it('limits the calendar span', async () => {
      await expect(
        service.availability(reception, { from: '2026-01-01', to: '2026-06-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
