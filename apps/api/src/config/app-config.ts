import { z } from 'zod';

export const APP_CONFIG = Symbol('APP_CONFIG');

const booleanFlag = z.enum(['true', 'false']).transform((value) => value === 'true');

export const AppConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'DATABASE_URL must be a PostgreSQL URL'),
  REDIS_URL: z
    .string()
    .regex(/^rediss?:\/\//, 'REDIS_URL must be a Redis URL')
    .default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters long'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().max(90).default(30),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  COOKIE_SECURE: booleanFlag.default(true),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

/** Validates the environment once at startup: the API refuses to boot with an invalid configuration. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = AppConfigSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
