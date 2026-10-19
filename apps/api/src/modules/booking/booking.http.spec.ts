import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Role } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../../app.setup';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { jwtOptions } from '../auth/jwt.options';
import { TokenService } from '../auth/token.service';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

const tenantId = randomUUID();

describe('Booking endpoints (HTTP): validation and role-based access', () => {
  const rooms = { list: vi.fn(), create: vi.fn(), update: vi.fn() };
  const reservations = { create: vi.fn(), list: vi.fn(), cancel: vi.fn(), availability: vi.fn() };
  let app: NestExpressApplication;
  let server: Server;
  let tokens: TokenService;

  const tokenFor = (role: Role) => tokens.sign({ userId: randomUUID(), tenantId, role });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register(
          jwtOptions({ JWT_ACCESS_SECRET: 's'.repeat(40), JWT_ACCESS_TTL_SECONDS: 900 }),
        ),
      ],
      controllers: [RoomsController, ReservationsController],
      providers: [
        TokenService,
        { provide: RoomsService, useValue: rooms },
        { provide: ReservationsService, useValue: reservations },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, { CORS_ORIGINS: [], NODE_ENV: 'production' });
    await app.init();
    server = app.getHttpServer();
    tokens = app.get(TokenService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    const response = await request(server).get('/api/rooms');

    expect(response.status).toBe(401);
  });

  it('lets every role read the rooms', async () => {
    rooms.list.mockResolvedValue([]);

    const response = await request(server)
      .get('/api/rooms')
      .auth(await tokenFor('HOUSEKEEPING'), { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(rooms.list).toHaveBeenCalledWith(expect.objectContaining({ tenantId }));
  });

  it('only lets the owner create rooms', async () => {
    const response = await request(server)
      .post('/api/rooms')
      .auth(await tokenFor('RECEPTION'), { type: 'bearer' })
      .send({ name: 'Atlas', capacity: 2, baseRateCents: 85_000 });

    expect(response.status).toBe(403);
    expect(rooms.create).not.toHaveBeenCalled();
  });

  it('validates the room payload', async () => {
    const response = await request(server)
      .post('/api/rooms')
      .auth(await tokenFor('OWNER'), { type: 'bearer' })
      .send({ name: '', capacity: 0, baseRateCents: 12.5 });

    expect(response.status).toBe(400);
    expect((response.body as { errors: { path: string }[] }).errors.map((e) => e.path)).toEqual([
      'name',
      'capacity',
      'baseRateCents',
    ]);
  });

  it('creates a room for the owner', async () => {
    rooms.create.mockResolvedValue({ id: randomUUID() });

    const response = await request(server)
      .post('/api/rooms')
      .auth(await tokenFor('OWNER'), { type: 'bearer' })
      .send({ name: 'Atlas', capacity: 2, baseRateCents: 85_000 });

    expect(response.status).toBe(201);
  });

  it('rejects a malformed room id', async () => {
    const response = await request(server)
      .patch('/api/rooms/not-a-uuid')
      .auth(await tokenFor('OWNER'), { type: 'bearer' })
      .send({ isActive: false });

    expect(response.status).toBe(400);
    expect(rooms.update).not.toHaveBeenCalled();
  });

  it('does not let housekeeping create reservations', async () => {
    const response = await request(server)
      .post('/api/reservations')
      .auth(await tokenFor('HOUSEKEEPING'), { type: 'bearer' })
      .send({});

    expect(response.status).toBe(403);
  });

  it('validates and coerces the list query', async () => {
    reservations.list.mockResolvedValue({ items: [], nextCursor: null });

    const response = await request(server)
      .get('/api/reservations?from=2026-10-01&to=2026-11-01&limit=20')
      .auth(await tokenFor('RECEPTION'), { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(reservations.list).toHaveBeenCalledWith(expect.anything(), {
      from: '2026-10-01',
      to: '2026-11-01',
      limit: 20,
    });
  });

  it('shows availability to housekeeping', async () => {
    reservations.availability.mockResolvedValue({ from: '', to: '', rooms: [] });

    const response = await request(server)
      .get('/api/availability?from=2026-10-19&to=2026-11-02')
      .auth(await tokenFor('HOUSEKEEPING'), { type: 'bearer' });

    expect(response.status).toBe(200);
  });
});
