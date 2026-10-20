import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import type { PrismaClient, Room, Tenant } from '@prisma/client';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { TenantDb } from '../../src/infrastructure/prisma/tenant-db.service';
import { RedisLock } from '../../src/infrastructure/redis/redis-lock.service';
import type { AuthUser } from '../../src/modules/auth/auth.types';
import { ReservationsService } from '../../src/modules/booking/reservations.service';
import { appClient, createRoom, createTenant, ownerClient } from './fixtures';

const CONCURRENT_ATTEMPTS = 8;

function stay(checkIn: string, checkOut: string, room: Room, guest = 'Guest') {
  return { roomId: room.id, checkIn, checkOut, adults: 1, children: 0, guest: { fullName: guest } };
}

describe('Anti-overbooking (PostgreSQL + Redis)', () => {
  let owner: PrismaClient;
  let app: PrismaService;
  let redis: Redis;
  let riad: Tenant;
  let reception: AuthUser;
  let service: ReservationsService;

  beforeAll(async () => {
    owner = ownerClient();
    app = appClient();
    redis = new Redis(inject('redisUrl'));
    riad = await createTenant(owner, 'RiadOverbooking');
    reception = { userId: randomUUID(), tenantId: riad.id, role: 'RECEPTION' };
    service = new ReservationsService(new TenantDb(app), new RedisLock(redis));
  });

  afterAll(async () => {
    await Promise.all([owner.$disconnect(), app.$disconnect(), redis.quit()]);
  });

  async function bookConcurrently(target: ReservationsService, room: Room) {
    const attempts = await Promise.allSettled(
      Array.from({ length: CONCURRENT_ATTEMPTS }, (_, index) =>
        target.create(reception, stay('2027-01-10', '2027-01-13', room, `Guest ${index}`)),
      ),
    );
    const rejected = attempts.filter((attempt) => attempt.status === 'rejected');
    return {
      succeeded: attempts.filter((attempt) => attempt.status === 'fulfilled').length,
      allRejectionsAreConflicts: rejected.every(
        (attempt) => attempt.reason instanceof ConflictException,
      ),
      stored: await owner.reservation.count({ where: { roomId: room.id } }),
    };
  }

  it('lets exactly one of several concurrent bookings of the same nights succeed', async () => {
    const room = await createRoom(owner, riad.id, 'Atlas');

    await expect(bookConcurrently(service, room)).resolves.toEqual({
      succeeded: 1,
      allRejectionsAreConflicts: true,
      stored: 1,
    });
  });

  it('still guarantees a single winner when the Redis lock is bypassed', async () => {
    const room = await createRoom(owner, riad.id, 'Toubkal');
    const noLock = {
      withLock: (_key: string, _options: unknown, work: () => Promise<unknown>) => work(),
    } as unknown as RedisLock;

    await expect(
      bookConcurrently(new ReservationsService(new TenantDb(app), noLock), room),
    ).resolves.toEqual({ succeeded: 1, allRejectionsAreConflicts: true, stored: 1 });
  });

  it('accepts back-to-back stays: departure and arrival on the same day', async () => {
    const room = await createRoom(owner, riad.id, 'Ourika');

    await service.create(reception, stay('2027-02-10', '2027-02-12', room));

    await expect(
      service.create(reception, stay('2027-02-12', '2027-02-14', room)),
    ).resolves.toMatchObject({ checkIn: '2027-02-12' });
  });

  it('frees the nights of a cancelled reservation', async () => {
    const room = await createRoom(owner, riad.id, 'Agafay');
    const first = await service.create(reception, stay('2027-03-10', '2027-03-12', room));

    await service.cancel(reception, first.id);

    await expect(
      service.create(reception, stay('2027-03-10', '2027-03-12', room)),
    ).resolves.toMatchObject({ status: 'CONFIRMED' });
  });

  it('rejects an overlapping row written directly in SQL, bypassing the API', async () => {
    const room = await createRoom(owner, riad.id, 'Imlil');
    const guest = await owner.guest.create({ data: { tenantId: riad.id, fullName: 'Direct SQL' } });
    const insert = (checkIn: string, checkOut: string) => owner.$executeRaw`
      INSERT INTO reservations
        (id, tenant_id, room_id, guest_id, check_in, check_out, adults, total_cents, currency, updated_at)
      VALUES
        (gen_random_uuid(), ${riad.id}::uuid, ${room.id}::uuid, ${guest.id}::uuid,
         ${checkIn}::date, ${checkOut}::date, 1, 0, 'MAD', now())`;

    await insert('2027-04-10', '2027-04-15');

    await expect(insert('2027-04-14', '2027-04-16')).rejects.toThrow(/reservations_no_overlap/);
  });
});
