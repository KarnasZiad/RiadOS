import { randomUUID } from 'node:crypto';
import { type ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';
import type { AuthenticatedRequest, AuthUser } from '../auth.types';
import { Public, Roles } from '../decorators';
import { jwtOptions } from '../jwt.options';
import { TokenService } from '../token.service';
import { bearerToken, JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

class RoomsController {
  @Public()
  catalogue(): void {
    // Public route.
  }

  list(): void {
    // Authenticated route.
  }

  @Roles('OWNER')
  create(): void {
    // Owner-only route.
  }
}

function context(handler: () => void, request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => RoomsController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const reflector = new Reflector();
const tokens = new TokenService(
  new JwtService(jwtOptions({ JWT_ACCESS_SECRET: 's'.repeat(40), JWT_ACCESS_TTL_SECONDS: 900 })),
);
const reception: AuthUser = { userId: randomUUID(), tenantId: randomUUID(), role: 'RECEPTION' };
const { prototype: routes } = RoomsController;

describe('bearerToken', () => {
  it.each([
    ['Bearer abc', 'abc'],
    ['bearer abc', 'abc'],
    ['Basic abc', undefined],
    ['Bearer', undefined],
    ['Bearer abc def', undefined],
    [undefined, undefined],
  ])('extracts the token from %s', (header, expected) => {
    expect(bearerToken(header)).toBe(expected);
  });
});

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard(reflector, tokens);

  it('lets public routes through without a token', async () => {
    await expect(guard.canActivate(context(routes.catalogue, { headers: {} }))).resolves.toBe(true);
  });

  it('rejects a request without a bearer token', async () => {
    await expect(guard.canActivate(context(routes.list, { headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('authenticates a valid token and exposes the caller', async () => {
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: `Bearer ${await tokens.sign(reception)}` },
    };

    await expect(guard.canActivate(context(routes.list, request))).resolves.toBe(true);
    expect(request.user).toEqual(reception);
  });
});

describe('RolesGuard', () => {
  const guard = new RolesGuard(reflector);

  it('allows routes without role requirements', () => {
    expect(guard.canActivate(context(routes.list, { user: reception }))).toBe(true);
  });

  it('allows the required role', () => {
    expect(
      guard.canActivate(context(routes.create, { user: { ...reception, role: 'OWNER' } })),
    ).toBe(true);
  });

  it('forbids other roles', () => {
    expect(() => guard.canActivate(context(routes.create, { user: reception }))).toThrow(
      ForbiddenException,
    );
  });
});
