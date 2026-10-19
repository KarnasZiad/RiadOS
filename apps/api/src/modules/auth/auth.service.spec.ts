import { randomUUID } from 'node:crypto';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthService } from './auth.service';
import { jwtOptions } from './jwt.options';
import type { PasswordHasher } from './password-hasher';
import type { RefreshTokenService } from './refresh-token.service';
import { TokenService } from './token.service';

const tenant = { id: randomUUID(), name: 'Riad Yasmine', slug: 'riad-yasmine-abc123' };

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    tenantId: tenant.id,
    email: 'owner@riad-yasmine.ma',
    fullName: 'Amina Benali',
    passwordHash: 'hashed:correct horse battery',
    role: 'OWNER' as const,
    isActive: true,
    tenant,
    ...overrides,
  };
}

describe('AuthService', () => {
  const issued = { token: 'refresh-token', expiresAt: new Date(Date.now() + 1_000_000) };
  const tokens = new TokenService(
    new JwtService(jwtOptions({ JWT_ACCESS_SECRET: 's'.repeat(40), JWT_ACCESS_TTL_SECONDS: 900 })),
  );

  let prisma: {
    user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
    tenant: { create: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let hasher: { [K in keyof PasswordHasher]: ReturnType<typeof vi.fn> };
  let refreshTokens: { [K in keyof RefreshTokenService]: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: vi.fn(), create: vi.fn() },
      tenant: { create: vi.fn() },
      $transaction: vi.fn((work: (tx: unknown) => Promise<unknown>) => work(prisma)),
    };
    hasher = {
      hash: vi.fn((password: string) => Promise.resolve(`hashed:${password}`)),
      verify: vi.fn((hash: string, password: string) =>
        Promise.resolve(hash === `hashed:${password}`),
      ),
      verifyAgainstDummy: vi.fn(() => Promise.resolve()),
    };
    refreshTokens = {
      issue: vi.fn(() => Promise.resolve(issued)),
      rotate: vi.fn(),
      revoke: vi.fn(() => Promise.resolve()),
      revokeAllForUser: vi.fn(() => Promise.resolve()),
    };
    service = new AuthService(
      prisma as unknown as PrismaService,
      hasher as unknown as PasswordHasher,
      tokens,
      refreshTokens as unknown as RefreshTokenService,
      { JWT_ACCESS_TTL_SECONDS: 900 },
    );
  });

  describe('register', () => {
    const input = {
      propertyName: 'Riad Yasmine',
      fullName: 'Amina Benali',
      email: 'owner@riad-yasmine.ma',
      password: 'correct horse battery',
    };

    it('creates the property and its owner, then opens a session', async () => {
      prisma.tenant.create.mockResolvedValue(tenant);
      const owner = userRow();
      prisma.user.create.mockResolvedValue(owner);

      const session = await service.register(input);

      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: {
          name: 'Riad Yasmine',
          slug: expect.stringMatching(/^riad-yasmine-[0-9a-f]{6}$/) as unknown,
        },
      });
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'OWNER',
            passwordHash: 'hashed:correct horse battery',
          }) as unknown,
        }),
      );
      expect(session.user).toEqual({
        id: owner.id,
        email: owner.email,
        fullName: owner.fullName,
        role: 'OWNER',
        tenant: { id: tenant.id, name: tenant.name },
      });
      expect(session.refreshToken).toBe(issued);
      await expect(tokens.verify(session.accessToken)).resolves.toEqual({
        userId: owner.id,
        tenantId: tenant.id,
        role: 'OWNER',
      });
    });

    it('refuses an e-mail address that is already registered', async () => {
      prisma.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.register(input)).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not hide unexpected errors', async () => {
      prisma.$transaction.mockRejectedValue(new Error('database down'));

      await expect(service.register(input)).rejects.toThrow('database down');
    });
  });

  describe('login', () => {
    const credentials = { email: 'owner@riad-yasmine.ma', password: 'correct horse battery' };

    it('opens a session for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());

      const session = await service.login(credentials);

      expect(session.expiresIn).toBe(900);
      expect(refreshTokens.issue).toHaveBeenCalledTimes(1);
    });

    it('rejects a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());

      await expect(service.login({ ...credentials, password: 'wrong' })).rejects.toThrow(
        'Invalid email or password',
      );
      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });

    it.each([
      ['an unknown account', null],
      ['a disabled account', userRow({ isActive: false })],
    ])('rejects %s after a full-cost hash verification', async (_label, user) => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.login(credentials)).rejects.toThrow('Invalid email or password');
      expect(hasher.verifyAgainstDummy).toHaveBeenCalledWith(credentials.password);
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and issues a new access token', async () => {
      const user = userRow();
      const rotated = { token: 'rotated', expiresAt: new Date() };
      refreshTokens.rotate.mockResolvedValue({ userId: user.id, refreshToken: rotated });
      prisma.user.findUnique.mockResolvedValue(user);

      const session = await service.refresh('refresh-token');

      expect(refreshTokens.rotate).toHaveBeenCalledWith('refresh-token');
      expect(session.refreshToken).toBe(rotated);
    });

    it('requires a refresh token', async () => {
      await expect(service.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('closes every session of a disabled account', async () => {
      const user = userRow({ isActive: false });
      refreshTokens.rotate.mockResolvedValue({ userId: user.id, refreshToken: issued });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.refresh('refresh-token')).rejects.toThrow('Account disabled');
      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith(user.id);
    });
  });

  it('revokes the session on logout', async () => {
    await service.logout('refresh-token');
    await service.logout(undefined);

    expect(refreshTokens.revoke).toHaveBeenCalledTimes(1);
    expect(refreshTokens.revoke).toHaveBeenCalledWith('refresh-token');
  });

  it('returns the profile of the caller', async () => {
    const user = userRow();
    prisma.user.findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
    const caller = { userId: user.id, tenantId: tenant.id, role: 'OWNER' as const };

    await expect(service.me(caller)).resolves.toMatchObject({ email: user.email });
    await expect(service.me(caller)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
