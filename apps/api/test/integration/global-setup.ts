import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import type { TestProject } from 'vitest/node';

// pnpm scripts run from apps/api.
const API_ROOT = process.cwd();
const APP_LOGIN = { user: 'riados_api_test', password: 'riados_api_test' };

declare module 'vitest' {
  export interface ProvidedContext {
    /** Schema owner (superuser in the container): bypasses RLS, used to arrange test data. */
    databaseOwnerUrl: string;
    /** Login role member of riados_app, exactly like the API in production: RLS applies. */
    databaseAppUrl: string;
    redisUrl: string;
  }
}

/** Starts PostgreSQL and Redis once for the whole integration suite and applies the migrations. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const [postgres, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:17-alpine')
      .withDatabase('riados')
      .withUsername('riados_owner')
      .withPassword('riados_owner')
      .start(),
    new RedisContainer('redis:7.4-alpine').start(),
  ]);

  const ownerUrl = postgres.getConnectionUri();
  execSync('pnpm exec prisma migrate deploy', {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: ownerUrl, DIRECT_URL: ownerUrl },
    stdio: 'inherit',
  });

  const owner = new PrismaClient({ datasourceUrl: ownerUrl });
  await owner.$executeRawUnsafe(
    `CREATE ROLE ${APP_LOGIN.user} LOGIN PASSWORD '${APP_LOGIN.password}' IN ROLE riados_app`,
  );
  await owner.$disconnect();

  const appUrl = new URL(ownerUrl);
  appUrl.username = APP_LOGIN.user;
  appUrl.password = APP_LOGIN.password;

  project.provide('databaseOwnerUrl', ownerUrl);
  project.provide('databaseAppUrl', appUrl.toString());
  project.provide('redisUrl', redis.getConnectionUrl());

  return async () => {
    await Promise.all([postgres.stop(), redis.stop()]);
  };
}
