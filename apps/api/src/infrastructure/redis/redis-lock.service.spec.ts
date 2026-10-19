import { describe, expect, it } from 'vitest';
import { FakeRedis } from '../../testing/fake-redis';
import { LockNotAcquiredError, RedisLock } from './redis-lock.service';

describe('RedisLock', () => {
  it('grants the lock to a single holder at a time', async () => {
    const lock = new RedisLock(new FakeRedis().asRedis());

    const token = await lock.acquire('room:1', 1_000);

    expect(token).toEqual(expect.any(String));
    await expect(lock.acquire('room:1', 1_000)).resolves.toBeNull();
    await expect(lock.acquire('room:2', 1_000)).resolves.toEqual(expect.any(String));
  });

  it('only releases the lock with the token of its holder', async () => {
    const redis = new FakeRedis();
    const lock = new RedisLock(redis.asRedis());
    const token = await lock.acquire('room:1', 1_000);

    await expect(lock.release('room:1', 'someone-else')).resolves.toBe(false);
    expect(redis.get('room:1')).toBe(token);
    await expect(lock.release('room:1', token ?? '')).resolves.toBe(true);
    expect(redis.get('room:1')).toBeUndefined();
  });

  it('lets the lock expire when its holder crashed', async () => {
    let now = 0;
    const lock = new RedisLock(new FakeRedis(() => now).asRedis());
    await lock.acquire('room:1', 5_000);

    now = 5_000;

    await expect(lock.acquire('room:1', 5_000)).resolves.toEqual(expect.any(String));
  });

  it('runs the work under the lock and always releases it', async () => {
    const redis = new FakeRedis();
    const lock = new RedisLock(redis.asRedis());

    await expect(
      lock.withLock('room:1', { ttlMs: 1_000 }, () => {
        expect(redis.get('room:1')).toEqual(expect.any(String));
        return Promise.reject(new Error('booking failed'));
      }),
    ).rejects.toThrow('booking failed');

    expect(redis.get('room:1')).toBeUndefined();
  });

  it('waits for the current holder to release the lock', async () => {
    const redis = new FakeRedis();
    const lock = new RedisLock(redis.asRedis());
    const token = await lock.acquire('room:1', 1_000);
    setTimeout(() => void lock.release('room:1', token ?? ''), 20);

    const result = await lock.withLock('room:1', { ttlMs: 1_000, retryDelayMs: 5 }, () =>
      Promise.resolve('booked'),
    );

    expect(result).toBe('booked');
  });

  it('fails when the lock stays busy', async () => {
    const lock = new RedisLock(new FakeRedis().asRedis());
    await lock.acquire('room:1', 60_000);

    await expect(
      lock.withLock('room:1', { ttlMs: 1_000, retries: 2, retryDelayMs: 1 }, () =>
        Promise.resolve('never'),
      ),
    ).rejects.toBeInstanceOf(LockNotAcquiredError);
  });
});
