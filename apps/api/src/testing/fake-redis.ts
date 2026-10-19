import type { Redis } from 'ioredis';

interface Entry {
  value: string;
  expiresAt: number;
}

/**
 * In-memory stand-in for the subset of Redis used by RedisLock: `SET ... PX ... NX` and the
 * compare-and-delete release script. Real Redis is covered by the integration tests.
 */
export class FakeRedis {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  set(key: string, value: string, _px: 'PX', ttlMs: number, _nx: 'NX'): Promise<'OK' | null> {
    if (this.get(key) !== undefined) {
      return Promise.resolve(null);
    }
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
    return Promise.resolve('OK');
  }

  eval(_script: string, _numKeys: number, key: string, token: string): Promise<number> {
    if (this.get(key) !== token) {
      return Promise.resolve(0);
    }
    this.entries.delete(key);
    return Promise.resolve(1);
  }

  get(key: string): string | undefined {
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry?.value;
  }

  asRedis(): Redis {
    return this as unknown as Redis;
  }
}
