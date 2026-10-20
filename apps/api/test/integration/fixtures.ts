import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { inject } from 'vitest';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';

export function ownerClient(): PrismaClient {
  return new PrismaClient({ datasourceUrl: inject('databaseOwnerUrl') });
}

export function appClient(): PrismaService {
  return new PrismaService({ DATABASE_URL: inject('databaseAppUrl') });
}

export async function createTenant(owner: PrismaClient, name: string) {
  return owner.tenant.create({ data: { name, slug: `${name.toLowerCase()}-${randomUUID()}` } });
}

export async function createRoom(owner: PrismaClient, tenantId: string, name: string) {
  return owner.room.create({ data: { tenantId, name, capacity: 2, baseRateCents: 85_000 } });
}
