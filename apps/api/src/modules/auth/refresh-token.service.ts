import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const DAY_MS = 86_400_000;

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

export interface RotatedRefreshToken {
  userId: string;
  refreshToken: IssuedRefreshToken;
}

type RefreshTokenStore = Pick<Prisma.TransactionClient, 'refreshToken'>;

/** Only the SHA-256 of a refresh token is stored: a database leak exposes no usable token. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Opaque refresh tokens with rotation and reuse detection (ADR 0004).
 *
 * Every refresh consumes the presented token and issues a new one in the same family. Presenting a
 * consumed token means it was stolen or replayed: the whole family is revoked.
 */
@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: Pick<AppConfig, 'REFRESH_TOKEN_TTL_DAYS'>,
  ) {}

  async issue(
    userId: string,
    familyId: string = randomUUID(),
    store: RefreshTokenStore = this.prisma,
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.REFRESH_TOKEN_TTL_DAYS * DAY_MS);
    await store.refreshToken.create({
      data: { userId, familyId, tokenHash: hashRefreshToken(token), expiresAt },
    });
    return { token, expiresAt };
  }

  async rotate(presented: string): Promise<RotatedRefreshToken> {
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(presented) },
    });
    if (!current) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (current.revokedAt) {
      await this.revokeFamily(current.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (current.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const next = await this.prisma.$transaction(async (tx) => {
      // Conditional update: of two concurrent rotations of the same token, only one consumes it.
      const consumed = await tx.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return consumed.count === 1 ? this.issue(current.userId, current.familyId, tx) : null;
    });
    if (!next) {
      await this.revokeFamily(current.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    return { userId: current.userId, refreshToken: next };
  }

  async revoke(presented: string): Promise<void> {
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(presented) },
      select: { familyId: true },
    });
    if (current) {
      await this.revokeFamily(current.familyId);
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
