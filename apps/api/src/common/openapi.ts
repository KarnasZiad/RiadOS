import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';

/** Zod stays the single source of truth: the OpenAPI document is derived from the same schemas. */
export function openApiSchema(schema: z.ZodType): SchemaObject {
  return z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io: 'input',
    unrepresentable: 'any',
  }) as SchemaObject;
}
