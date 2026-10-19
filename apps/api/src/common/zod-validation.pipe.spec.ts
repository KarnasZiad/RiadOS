import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const schema = z.object({
  name: z.string().trim().min(2),
  guests: z.object({ adults: z.int().min(1) }),
});

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(schema);

  it('returns the parsed value', () => {
    expect(pipe.transform({ name: '  Atlas  ', guests: { adults: 2 } })).toEqual({
      name: 'Atlas',
      guests: { adults: 2 },
    });
  });

  it('reports every invalid field with its path', () => {
    let caught: unknown;
    try {
      pipe.transform({ name: 'A', guests: { adults: 0 } });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BadRequestException);
    const response = (caught as BadRequestException).getResponse() as { errors: unknown[] };
    expect(response.errors).toEqual([
      { path: 'name', message: expect.any(String) as string },
      { path: 'guests.adults', message: expect.any(String) as string },
    ]);
  });
});
