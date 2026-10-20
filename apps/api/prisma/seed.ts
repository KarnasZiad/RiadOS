/**
 * Demo data for local development: `pnpm --filter @riados/api db:seed`.
 * Runs with DIRECT_URL (schema owner) because it writes several tenants' worth of data.
 */
import { hash } from '@node-rs/argon2';
import { PrismaClient, Role } from '@prisma/client';

const DEMO_PASSWORD = 'riados-demo-2026';
const DAY_MS = 86_400_000;

function day(offset: number): Date {
  const today = new Date();
  return new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + offset * DAY_MS,
  );
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  });

  const existing = await prisma.tenant.findUnique({ where: { slug: 'riad-yasmine' } });
  if (existing) {
    console.log('Demo data already present, nothing to do.');
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await hash(DEMO_PASSWORD, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  const tenant = await prisma.tenant.create({
    data: { name: 'Riad Yasmine', slug: 'riad-yasmine' },
  });

  await prisma.user.createMany({
    data: [
      { email: 'owner@riad-yasmine.ma', fullName: 'Amina Benali', role: Role.OWNER },
      { email: 'reception@riad-yasmine.ma', fullName: 'Youssef Alaoui', role: Role.RECEPTION },
      { email: 'menage@riad-yasmine.ma', fullName: 'Fatima Zahra', role: Role.HOUSEKEEPING },
    ].map((user) => ({ ...user, tenantId: tenant.id, passwordHash })),
  });

  const rooms = await Promise.all(
    [
      { name: 'Atlas', capacity: 2, baseRateCents: 85_000 },
      { name: 'Toubkal', capacity: 3, baseRateCents: 110_000 },
      { name: 'Ourika', capacity: 2, baseRateCents: 75_000 },
      { name: 'Agafay', capacity: 4, baseRateCents: 140_000 },
      { name: 'Majorelle', capacity: 2, baseRateCents: 95_000 },
    ].map((room) => prisma.room.create({ data: { ...room, tenantId: tenant.id } })),
  );

  const stays = [
    { room: 0, guest: 'Sara El Idrissi', from: 0, nights: 3 },
    { room: 0, guest: 'Lucas Martin', from: 4, nights: 2 },
    { room: 1, guest: 'Emma Johnson', from: 1, nights: 5 },
    { room: 2, guest: 'Karim Tazi', from: -1, nights: 2 },
    { room: 3, guest: 'Famille Dubois', from: 2, nights: 4 },
    { room: 4, guest: 'Hiroshi Tanaka', from: 6, nights: 3 },
  ];

  for (const stay of stays) {
    const room = rooms[stay.room];
    if (!room) continue;
    const guest = await prisma.guest.create({
      data: { tenantId: tenant.id, fullName: stay.guest },
    });
    await prisma.reservation.create({
      data: {
        tenantId: tenant.id,
        roomId: room.id,
        guestId: guest.id,
        checkIn: day(stay.from),
        checkOut: day(stay.from + stay.nights),
        adults: Math.min(2, room.capacity),
        totalCents: room.baseRateCents * stay.nights,
        currency: tenant.currency,
      },
    });
  }

  console.log(`Seeded "${tenant.name}". Log in with owner@riad-yasmine.ma / ${DEMO_PASSWORD}`);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
