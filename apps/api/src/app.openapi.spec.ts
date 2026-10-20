import { JwtModule } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApp } from './app.setup';
import { APP_CONFIG } from './config/app-config';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { jwtOptions } from './modules/auth/jwt.options';
import { TokenService } from './modules/auth/token.service';
import { ReservationsController } from './modules/booking/reservations.controller';
import { ReservationsService } from './modules/booking/reservations.service';
import { RoomsController } from './modules/booking/rooms.controller';
import { RoomsService } from './modules/booking/rooms.service';

interface OpenApiDocument {
  info: { title: string };
  paths: Record<string, Record<string, { requestBody?: { content: Record<string, unknown> } }>>;
}

describe('OpenAPI document', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register(
          jwtOptions({ JWT_ACCESS_SECRET: 's'.repeat(40), JWT_ACCESS_TTL_SECONDS: 900 }),
        ),
      ],
      controllers: [AuthController, RoomsController, ReservationsController],
      providers: [
        TokenService,
        { provide: AuthService, useValue: {} },
        { provide: RoomsService, useValue: {} },
        { provide: ReservationsService, useValue: {} },
        { provide: APP_CONFIG, useValue: { COOKIE_SECURE: true } },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, { CORS_ORIGINS: [], NODE_ENV: 'development' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('is served outside production and documents every route', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json');
    const document = response.body as OpenApiDocument;

    expect(response.status).toBe(200);
    expect(document.info.title).toBe('RiadOS API');
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        '/api/auth/login',
        '/api/rooms',
        '/api/rooms/{id}',
        '/api/reservations',
        '/api/reservations/{id}/cancel',
        '/api/availability',
      ]),
    );
  });

  it('derives request bodies from the Zod schemas', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json');
    const document = response.body as OpenApiDocument;
    const body =
      document.paths['/api/reservations']?.post?.requestBody?.content['application/json'];

    expect(body).toMatchObject({
      schema: {
        type: 'object',
        required: expect.arrayContaining([
          'roomId',
          'checkIn',
          'checkOut',
          'adults',
          'guest',
        ]) as unknown,
      },
    });
  });
});
