import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { httpLoggerOptions } from './http-logger.options';

function request(headers: Record<string, string>, url = '/api/rooms'): IncomingMessage {
  return { headers, url } as unknown as IncomingMessage;
}

const response = {} as ServerResponse;

describe('httpLoggerOptions', () => {
  const options = httpLoggerOptions({ LOG_LEVEL: 'info', NODE_ENV: 'production' });

  it('reuses the request id of the reverse proxy', () => {
    expect(options.genReqId?.(request({ 'x-request-id': 'req-42' }), response)).toBe('req-42');
  });

  it('generates a request id when none is provided or when it is suspiciously long', () => {
    expect(options.genReqId?.(request({}), response)).toMatch(/^[0-9a-f-]{36}$/);
    expect(options.genReqId?.(request({ 'x-request-id': 'x'.repeat(500) }), response)).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });

  it('never logs credentials', () => {
    expect(options.redact).toMatchObject({
      paths: expect.arrayContaining(['req.headers.authorization', 'req.headers.cookie']) as unknown,
    });
  });

  it('does not log health checks', () => {
    const autoLogging = options.autoLogging as { ignore: (req: IncomingMessage) => boolean };

    expect(autoLogging.ignore(request({}, '/api/health'))).toBe(true);
    expect(autoLogging.ignore(request({}, '/api/rooms'))).toBe(false);
  });

  it('pretty-prints only in development', () => {
    expect(options.transport).toBeUndefined();
    expect(httpLoggerOptions({ LOG_LEVEL: 'debug', NODE_ENV: 'development' }).transport).toEqual({
      target: 'pino-pretty',
      options: { singleLine: true },
    });
  });
});
