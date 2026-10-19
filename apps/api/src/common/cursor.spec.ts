import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { decodeCursor, encodeCursor } from './cursor';

const CursorSchema = z.object({ checkIn: z.iso.date(), id: z.string() });

describe('cursor', () => {
  it('round-trips a cursor', () => {
    const cursor = encodeCursor({ checkIn: '2026-10-20', id: 'abc' });

    expect(cursor).toMatch(/^[\w-]+$/);
    expect(decodeCursor(cursor, CursorSchema)).toEqual({ checkIn: '2026-10-20', id: 'abc' });
  });

  it.each([
    ['a value that is not base64 JSON', 'not-a-cursor'],
    ['valid JSON with the wrong shape', encodeCursor({ page: 2 })],
  ])('rejects %s', (_label, cursor) => {
    expect(() => decodeCursor(cursor, CursorSchema)).toThrow(BadRequestException);
  });
});
