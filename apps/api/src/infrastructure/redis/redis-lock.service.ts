import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { sleep } from '../../common/sleep';
import { REDIS } from './redis.constants';

/** Deletes the key only if it still holds our token: a process never releases someone else's lock. */
const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export class LockNotAcquiredError extends Error {
  constructor(readonly key: string) {
    super(`Could not acquire lock "${key}"`);
    this.name = 'LockNotAcquiredError';
  }
}

export interface LockOptions {
  /** Time after which Redis drops the lock if its holder crashed. */
  ttlMs: number;
  retries?: number;
  retryDelayMs?: number;
}

/**
 * Single-instance Redis lock (`SET key token NX PX ttl`).
 *
 * It reduces contention but is not a correctness guarantee on its own (no fencing token): callers
 * must keep a database-level guarantee. See docs/architecture/anti-surreservation.md.
 */
@Injectable()
export class RedisLock {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async acquire(key: string, ttlMs: number): Promise<string | null> {
    const token = randomUUID();
    const result = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? token : null;
  }

  async release(key: string, token: string): Promise<boolean> {
    const deleted = await this.redis.eval(RELEASE_SCRIPT, 1, key, token);
    return deleted === 1;
  }

  async withLock<T>(key: string, options: LockOptions, work: () => Promise<T>): Promise<T> {
    const { ttlMs, retries = 50, retryDelayMs = 50 } = options;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const token = await this.acquire(key, ttlMs);
      if (token) {
        try {
          return await work();
        } finally {
          await this.release(key, token);
        }
      }
      if (attempt < retries) {
        await sleep(retryDelayMs + Math.floor(Math.random() * retryDelayMs));
      }
    }

    throw new LockNotAcquiredError(key);
  }
}
