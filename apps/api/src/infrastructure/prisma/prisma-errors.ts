import { Prisma } from '@prisma/client';
import { sleep } from '../../common/sleep';

/**
 * SQLSTATE 40001 (serialization failure). Prisma reports it as P2034 in interactive transactions,
 * but some query paths only expose the raw PostgreSQL message.
 */
export function isSerializationFailure(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2034';
  }
  return error instanceof Error && /could not serialize access|40001/.test(error.message);
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Prisma has no error code for exclusion or check constraints (SQLSTATE 23P01, 23514): the only
 * reliable signal is the constraint name in the database message.
 */
export function isConstraintViolation(error: unknown, constraint: string): boolean {
  return error instanceof Error && error.message.includes(constraint);
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
}

/** Replays a SERIALIZABLE transaction aborted by PostgreSQL, with exponential backoff and jitter. */
export async function retryOnSerializationFailure<T>(
  work: () => Promise<T>,
  { attempts = 3, baseDelayMs = 25 }: RetryOptions = {},
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= attempts || !isSerializationFailure(error)) {
        throw error;
      }
      await sleep(baseDelayMs * 2 ** (attempt - 1) + Math.random() * baseDelayMs);
    }
  }
}
