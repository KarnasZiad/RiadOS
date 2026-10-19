import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeTenantDb } from '../../testing/fake-tenant-db';
import type { AuthUser } from '../auth/auth.types';
import { RoomsService } from './rooms.service';

const owner: AuthUser = { userId: randomUUID(), tenantId: randomUUID(), role: 'OWNER' };
const room = {
  id: randomUUID(),
  name: 'Atlas',
  capacity: 2,
  baseRateCents: 85_000,
  isActive: true,
};

describe('RoomsService', () => {
  let tx: {
    room: {
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
    };
  };
  let db: FakeTenantDb;
  let service: RoomsService;

  beforeEach(() => {
    tx = {
      room: {
        findMany: vi.fn().mockResolvedValue([room]),
        create: vi.fn().mockResolvedValue(room),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(room),
      },
    };
    db = new FakeTenantDb(tx);
    service = new RoomsService(db.asTenantDb());
  });

  it('lists the rooms of the caller tenant only', async () => {
    await expect(service.list(owner)).resolves.toEqual([room]);

    expect(db.calls).toEqual([{ tenantId: owner.tenantId, isolationLevel: undefined }]);
    expect(tx.room.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: owner.tenantId } }),
    );
  });

  it('creates a room in the caller tenant', async () => {
    await service.create(owner, { name: 'Atlas', capacity: 2, baseRateCents: 85_000 });

    expect(tx.room.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Atlas', capacity: 2, baseRateCents: 85_000, tenantId: owner.tenantId },
      }),
    );
  });

  it('reports a duplicate room name as a conflict', async () => {
    tx.room.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create(owner, { name: 'Atlas', capacity: 2, baseRateCents: 85_000 }),
    ).rejects.toThrow(new ConflictException('A room named "Atlas" already exists'));
  });

  it('updates a room of the caller tenant', async () => {
    await expect(service.update(owner, room.id, { baseRateCents: 95_000 })).resolves.toEqual(room);

    expect(tx.room.updateMany).toHaveBeenCalledWith({
      where: { id: room.id, tenantId: owner.tenantId },
      data: { baseRateCents: 95_000 },
    });
  });

  it('does not reveal rooms of other tenants', async () => {
    tx.room.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.update(owner, randomUUID(), { isActive: false })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
