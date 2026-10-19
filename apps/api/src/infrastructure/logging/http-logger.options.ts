import { randomUUID } from 'node:crypto';
import type { Options } from 'pino-http';
import type { AppConfig } from '../../config/app-config';

const MAX_REQUEST_ID_LENGTH = 128;

/** Structured JSON logs (Pino) with a request id and without credentials. */
export function httpLoggerOptions(config: Pick<AppConfig, 'LOG_LEVEL' | 'NODE_ENV'>): Options {
  return {
    level: config.LOG_LEVEL,
    // Reuse the id set by the reverse proxy so a request can be followed across services.
    genReqId: (req) => {
      const header = req.headers['x-request-id'];
      return typeof header === 'string' && header.length <= MAX_REQUEST_ID_LENGTH
        ? header
        : randomUUID();
    },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      censor: '[redacted]',
    },
    autoLogging: {
      ignore: (req) => req.url?.startsWith('/api/health') ?? false,
    },
    ...(config.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
      : {}),
  };
}
