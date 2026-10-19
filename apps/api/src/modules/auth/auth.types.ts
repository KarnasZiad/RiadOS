import { Role } from '@prisma/client';
import type { Request } from 'express';
import { z } from 'zod';

/** Identity of the caller, extracted from a verified access token. */
export interface AuthUser {
  userId: string;
  tenantId: string;
  role: Role;
}

export const AccessTokenPayloadSchema = z.object({
  sub: z.uuid(),
  tid: z.uuid(),
  role: z.enum(Role),
});

export type AccessTokenPayload = z.infer<typeof AccessTokenPayloadSchema>;

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
