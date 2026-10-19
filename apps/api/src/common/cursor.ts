import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';

/**
 * Opaque keyset-pagination cursor. Clients must not build or interpret it: it is a base64url JSON
 * document, validated again when it comes back.
 */
export function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeCursor<T>(cursor: string, schema: z.ZodType<T>): T {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return schema.parse(decoded);
  } catch {
    throw new BadRequestException('Invalid pagination cursor');
  }
}
