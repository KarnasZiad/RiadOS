import type { Response } from 'express';
import type { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { HealthController } from './health.controller';

function controller(database: () => Promise<unknown>, redis: () => Promise<unknown>) {
  const prisma = { $queryRaw: vi.fn(database) } as unknown as PrismaService;
  const client = { ping: vi.fn(redis) } as unknown as Redis;
  return new HealthController(prisma, client);
}

function response() {
  const res = { status: vi.fn() };
  return { res, typed: res as unknown as Response };
}

describe('HealthController', () => {
  it('reports liveness without touching dependencies', () => {
    expect(
      controller(
        () => Promise.reject(new Error('down')),
        () => Promise.reject(new Error('down')),
      ).live(),
    ).toEqual({ status: 'ok' });
  });

  it('is ready when PostgreSQL and Redis answer', async () => {
    const { res, typed } = response();

    const report = await controller(
      () => Promise.resolve([{ '?column?': 1 }]),
      () => Promise.resolve('PONG'),
    ).ready(typed);

    expect(report).toEqual({ status: 'ok', checks: { database: 'up', redis: 'up' } });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 503 when a dependency is down', async () => {
    const { res, typed } = response();

    const report = await controller(
      () => Promise.resolve([]),
      () => Promise.reject(new Error('ECONNREFUSED')),
    ).ready(typed);

    expect(report).toEqual({ status: 'unavailable', checks: { database: 'up', redis: 'down' } });
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
