import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  isConstraintViolation,
  isSerializationFailure,
  isUniqueViolation,
  retryOnSerializationFailure,
} from './prisma-errors';

function knownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`Prisma error ${code}`, {
    code,
    clientVersion: 'test',
  });
}

describe('Prisma error helpers', () => {
  it('detects serialization failures from the Prisma code or the raw message', () => {
    expect(isSerializationFailure(knownError('P2034'))).toBe(true);
    expect(isSerializationFailure(new Error('could not serialize access due to read/write'))).toBe(
      true,
    );
    expect(isSerializationFailure(knownError('P2002'))).toBe(false);
    expect(isSerializationFailure('P2034')).toBe(false);
  });

  it('detects unique violations', () => {
    expect(isUniqueViolation(knownError('P2002'))).toBe(true);
    expect(isUniqueViolation(new Error('P2002'))).toBe(false);
  });

  it('detects a named constraint violation', () => {
    const error = new Error(
      'conflicting key value violates exclusion constraint "reservations_no_overlap"',
    );

    expect(isConstraintViolation(error, 'reservations_no_overlap')).toBe(true);
    expect(isConstraintViolation(error, 'rooms_capacity_check')).toBe(false);
  });
});

describe('retryOnSerializationFailure', () => {
  it('replays the work until it succeeds', async () => {
    const work = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(knownError('P2034'))
      .mockResolvedValueOnce('committed');

    await expect(retryOnSerializationFailure(work, { baseDelayMs: 1 })).resolves.toBe('committed');
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('gives up after the last attempt', async () => {
    const work = vi.fn<() => Promise<string>>().mockRejectedValue(knownError('P2034'));

    await expect(
      retryOnSerializationFailure(work, { attempts: 3, baseDelayMs: 1 }),
    ).rejects.toThrow('Prisma error P2034');
    expect(work).toHaveBeenCalledTimes(3);
  });

  it('does not retry other errors', async () => {
    const work = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('boom'));

    await expect(retryOnSerializationFailure(work)).rejects.toThrow('boom');
    expect(work).toHaveBeenCalledTimes(1);
  });
});
