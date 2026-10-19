import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeRefreshTokenPrisma } from '../../testing/fake-refresh-token-prisma';
import { hashRefreshToken, RefreshTokenService } from './refresh-token.service';

const DAY_MS = 86_400_000;

describe('RefreshTokenService', () => {
  const userId = randomUUID();
  let prisma: FakeRefreshTokenPrisma;
  let service: RefreshTokenService;

  beforeEach(() => {
    prisma = new FakeRefreshTokenPrisma();
    service = new RefreshTokenService(prisma.asPrisma(), { REFRESH_TOKEN_TTL_DAYS: 30 });
  });

  it('issues an opaque 256-bit token and stores only its hash', async () => {
    const issued = await service.issue(userId);

    expect(Buffer.from(issued.token, 'base64url')).toHaveLength(32);
    expect(prisma.rows[0]?.tokenHash).toBe(hashRefreshToken(issued.token));
    expect(JSON.stringify(prisma.rows)).not.toContain(issued.token);
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * DAY_MS);
  });

  it('rotates a token inside its family', async () => {
    const first = await service.issue(userId);

    const rotated = await service.rotate(first.token);

    expect(rotated.userId).toBe(userId);
    expect(rotated.refreshToken.token).not.toBe(first.token);
    const [consumed, fresh] = prisma.rows;
    expect(consumed?.revokedAt).toBeInstanceOf(Date);
    expect(fresh?.revokedAt).toBeNull();
    expect(fresh?.familyId).toBe(consumed?.familyId);
  });

  it('revokes the whole family when a consumed token is replayed', async () => {
    const first = await service.issue(userId);
    const second = await service.rotate(first.token);

    await expect(service.rotate(first.token)).rejects.toThrow('Refresh token reuse detected');

    // The latest token is revoked too: whoever holds it, the session is over.
    await expect(service.rotate(second.refreshToken.token)).rejects.toThrow(
      'Refresh token reuse detected',
    );
    expect(prisma.rows.every((row) => row.revokedAt !== null)).toBe(true);
  });

  it('treats a lost race between two concurrent rotations as a reuse', async () => {
    const first = await service.issue(userId);
    prisma.loseNextConsumptionRace = true;

    await expect(service.rotate(first.token)).rejects.toThrow('Refresh token reuse detected');
    expect(prisma.rows.every((row) => row.revokedAt !== null)).toBe(true);
  });

  it('rejects unknown and expired tokens', async () => {
    const issued = await service.issue(userId);
    const row = prisma.rows[0];
    if (row) {
      row.expiresAt = new Date(Date.now() - 1_000);
    }

    await expect(service.rotate('unknown-token')).rejects.toThrow('Invalid refresh token');
    await expect(service.rotate(issued.token)).rejects.toThrow('Refresh token expired');
  });

  it('revokes the family of a token on logout and ignores unknown tokens', async () => {
    const first = await service.issue(userId);
    await service.rotate(first.token);
    const other = await service.issue(userId);

    await service.revoke(first.token);
    await service.revoke('unknown-token');

    const familyOfFirst = prisma.rows[0]?.familyId;
    const rows = prisma.rows.filter((row) => row.familyId === familyOfFirst);
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
    expect(
      prisma.rows.find((row) => row.tokenHash === hashRefreshToken(other.token))?.revokedAt,
    ).toBeNull();
  });

  it('revokes every session of a user', async () => {
    await service.issue(userId);
    await service.issue(userId);
    await service.issue(randomUUID());

    await service.revokeAllForUser(userId);

    expect(prisma.rows.map((row) => row.revokedAt !== null)).toEqual([true, true, false]);
  });
});
