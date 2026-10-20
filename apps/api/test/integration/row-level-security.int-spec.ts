import type { PrismaClient, Tenant } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { TenantDb } from '../../src/infrastructure/prisma/tenant-db.service';
import { appClient, createRoom, createTenant, ownerClient } from './fixtures';

describe('Row-Level Security (PostgreSQL, API database role)', () => {
  let owner: PrismaClient;
  let app: PrismaService;
  let db: TenantDb;
  let riadA: Tenant;
  let riadB: Tenant;

  beforeAll(async () => {
    owner = ownerClient();
    app = appClient();
    db = new TenantDb(app);
    riadA = await createTenant(owner, 'RiadA');
    riadB = await createTenant(owner, 'RiadB');
    await createRoom(owner, riadA.id, 'Atlas');
    await createRoom(owner, riadB.id, 'Toubkal');
  });

  afterAll(async () => {
    await Promise.all([owner.$disconnect(), app.$disconnect()]);
  });

  it('only returns the rows of the current tenant, even without a tenant filter', async () => {
    const rooms = await db.run(riadA.id, (tx) => tx.room.findMany());

    expect(rooms.map((room) => room.name)).toEqual(['Atlas']);
  });

  it('returns nothing outside a tenant transaction (fail closed)', async () => {
    await expect(app.room.findMany()).resolves.toEqual([]);
  });

  it('cannot update the rows of another tenant', async () => {
    const result = await db.run(riadA.id, (tx) =>
      tx.room.updateMany({ where: { name: 'Toubkal' }, data: { baseRateCents: 1 } }),
    );

    expect(result.count).toBe(0);
  });

  it('refuses to insert a row for another tenant', async () => {
    await expect(
      db.run(riadA.id, (tx) =>
        tx.room.create({
          data: { tenantId: riadB.id, name: 'Intruder', capacity: 1, baseRateCents: 0 },
        }),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('keeps reservations inside their tenant through composite foreign keys', async () => {
    const roomOfB = await owner.room.findFirstOrThrow({ where: { tenantId: riadB.id } });
    const guestOfA = await owner.guest.create({
      data: { tenantId: riadA.id, fullName: 'Guest A' },
    });

    await expect(
      owner.reservation.create({
        data: {
          tenantId: riadA.id,
          roomId: roomOfB.id,
          guestId: guestOfA.id,
          checkIn: new Date('2027-03-01'),
          checkOut: new Date('2027-03-02'),
          adults: 1,
          totalCents: 85_000,
          currency: 'MAD',
        },
      }),
    ).rejects.toThrow(/reservations_room_id_tenant_id_fkey/);
  });

  it('does not leak the tenant setting beyond the transaction', async () => {
    await db.run(riadA.id, (tx) => tx.room.findMany());

    const [row] = await app.$queryRaw<{ tenant: string | null }[]>`
      SELECT current_setting('app.tenant_id', true) AS tenant`;
    expect(row?.tenant ?? '').toBe('');
  });
});
