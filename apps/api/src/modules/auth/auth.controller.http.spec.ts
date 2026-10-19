import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { UnauthorizedException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../../app.setup';
import { APP_CONFIG } from '../../config/app-config';
import { AuthController } from './auth.controller';
import { type AuthSession, AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { jwtOptions } from './jwt.options';
import { TokenService } from './token.service';

const config = {
  JWT_ACCESS_SECRET: 's'.repeat(40),
  JWT_ACCESS_TTL_SECONDS: 900,
  COOKIE_SECURE: true,
};

const user = {
  id: randomUUID(),
  email: 'reception@riad-yasmine.ma',
  fullName: 'Youssef Alaoui',
  role: 'RECEPTION' as const,
  tenant: { id: randomUUID(), name: 'Riad Yasmine' },
};

function session(token = 'refresh-token'): AuthSession {
  return {
    accessToken: 'access-token',
    expiresIn: 900,
    user,
    refreshToken: { token, expiresAt: new Date(Date.now() + 86_400_000) },
  };
}

describe('AuthController (HTTP)', () => {
  const auth = {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
  };
  let app: NestExpressApplication;
  let server: Server;
  let tokens: TokenService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register(jwtOptions(config))],
      controllers: [AuthController],
      providers: [
        TokenService,
        { provide: AuthService, useValue: auth },
        { provide: APP_CONFIG, useValue: config },
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

  it('rejects an invalid login payload before reaching the service', async () => {
    const response = await request(server)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: '' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ message: 'Validation failed' });
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('returns the access token and sets a hardened refresh cookie on login', async () => {
    auth.login.mockResolvedValue(session());

    const response = await request(server)
      .post('/api/auth/login')
      .send({ email: ' Reception@Riad-Yasmine.ma ', password: 'correct horse battery' });

    expect(response.status).toBe(200);
    expect(auth.login).toHaveBeenCalledWith({
      email: 'reception@riad-yasmine.ma',
      password: 'correct horse battery',
    });
    expect(response.body).toEqual({ accessToken: 'access-token', expiresIn: 900, user });
    const cookie = response.get('Set-Cookie')?.[0] ?? '';
    expect(cookie).toMatch(/^riados_rt=refresh-token;/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api/auth');
  });

  it('creates an account on register', async () => {
    auth.register.mockResolvedValue(session());

    const response = await request(server).post('/api/auth/register').send({
      propertyName: 'Riad Yasmine',
      fullName: 'Amina Benali',
      email: 'owner@riad-yasmine.ma',
      password: 'correct horse battery',
    });

    expect(response.status).toBe(201);
    expect(auth.register).toHaveBeenCalledTimes(1);
  });

  it('rotates the refresh cookie', async () => {
    auth.refresh.mockResolvedValue(session('rotated-token'));

    const response = await request(server)
      .post('/api/auth/refresh')
      .set('Cookie', 'riados_rt=refresh-token');

    expect(response.status).toBe(200);
    expect(auth.refresh).toHaveBeenCalledWith('refresh-token');
    expect(response.get('Set-Cookie')?.[0]).toMatch(/^riados_rt=rotated-token;/);
  });

  it('clears the refresh cookie when the refresh fails', async () => {
    auth.refresh.mockRejectedValue(new UnauthorizedException('Refresh token reuse detected'));

    const response = await request(server)
      .post('/api/auth/refresh')
      .set('Cookie', 'riados_rt=stolen-token');

    expect(response.status).toBe(401);
    expect(response.get('Set-Cookie')?.[0]).toMatch(/^riados_rt=;/);
  });

  it('revokes the session and clears the cookie on logout', async () => {
    auth.logout.mockResolvedValue(undefined);

    const response = await request(server)
      .post('/api/auth/logout')
      .set('Cookie', 'riados_rt=refresh-token');

    expect(response.status).toBe(204);
    expect(auth.logout).toHaveBeenCalledWith('refresh-token');
    expect(response.get('Set-Cookie')?.[0]).toMatch(/^riados_rt=;/);
  });

  it('protects the profile endpoint', async () => {
    const response = await request(server).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(auth.me).not.toHaveBeenCalled();
  });

  it('returns the profile of an authenticated caller', async () => {
    auth.me.mockResolvedValue(user);
    const token = await tokens.sign({ userId: user.id, tenantId: user.tenant.id, role: user.role });

    const response = await request(server).get('/api/auth/me').auth(token, { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(user);
    expect(auth.me).toHaveBeenCalledWith({
      userId: user.id,
      tenantId: user.tenant.id,
      role: 'RECEPTION',
    });
  });
});
