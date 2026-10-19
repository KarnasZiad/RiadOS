import { randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';
import type { AuthUser } from './auth.types';
import { jwtOptions } from './jwt.options';
import { TokenService } from './token.service';

const config = { JWT_ACCESS_SECRET: 's'.repeat(40), JWT_ACCESS_TTL_SECONDS: 900 };
const user: AuthUser = { userId: randomUUID(), tenantId: randomUUID(), role: 'RECEPTION' };

function tokenService(overrides: Partial<typeof config> = {}): TokenService {
  return new TokenService(new JwtService(jwtOptions({ ...config, ...overrides })));
}

describe('TokenService', () => {
  it('signs a token carrying the user, its tenant and its role', async () => {
    const tokens = tokenService();

    const token = await tokens.sign(user);

    await expect(tokens.verify(token)).resolves.toEqual(user);
  });

  it('rejects a token signed with another secret', async () => {
    const forged = await tokenService({ JWT_ACCESS_SECRET: 'x'.repeat(40) }).sign(user);

    await expect(tokenService().verify(forged)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    const expired = await tokenService({ JWT_ACCESS_TTL_SECONDS: -1 }).sign(user);

    await expect(tokenService().verify(expired)).rejects.toThrow('Invalid or expired access token');
  });

  it('rejects a validly signed token with unexpected claims', async () => {
    const jwt = new JwtService(jwtOptions(config));
    const token = await jwt.signAsync({ sub: 'not-a-uuid', tid: user.tenantId, role: 'ADMIN' });

    await expect(tokenService().verify(token)).rejects.toThrow('Invalid access token');
  });

  it('rejects garbage', async () => {
    await expect(tokenService().verify('not.a.jwt')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
