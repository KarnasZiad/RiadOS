import { describe, expect, it } from 'vitest';
import { loadConfig } from './app-config';

const validEnv = {
  DATABASE_URL: 'postgresql://riados_api:secret@localhost:5432/riados',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
};

describe('loadConfig', () => {
  it('applies secure defaults', () => {
    const config = loadConfig(validEnv);

    expect(config).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 30,
      CORS_ORIGINS: ['http://localhost:5173'],
      COOKIE_SECURE: true,
    });
  });

  it('parses numbers, booleans and comma-separated origins', () => {
    const config = loadConfig({
      ...validEnv,
      PORT: '8080',
      COOKIE_SECURE: 'false',
      CORS_ORIGINS: 'https://app.riados.ma, https://admin.riados.ma,',
    });

    expect(config.PORT).toBe(8080);
    expect(config.COOKIE_SECURE).toBe(false);
    expect(config.CORS_ORIGINS).toEqual(['https://app.riados.ma', 'https://admin.riados.ma']);
  });

  it('refuses a short JWT secret', () => {
    expect(() => loadConfig({ ...validEnv, JWT_ACCESS_SECRET: 'too-short' })).toThrow(
      /JWT_ACCESS_SECRET must be at least 32 characters long/,
    );
  });

  it('refuses a missing database URL', () => {
    expect(() => loadConfig({ JWT_ACCESS_SECRET: validEnv.JWT_ACCESS_SECRET })).toThrow(
      /DATABASE_URL/,
    );
  });
});
