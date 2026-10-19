import { randomBytes } from 'node:crypto';
import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Role, type Tenant, type User } from '@prisma/client';
import { slugify } from '../../common/slug';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { isUniqueViolation } from '../../infrastructure/prisma/prisma-errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { LoginInput, RegisterInput } from './auth.schemas';
import type { AuthUser } from './auth.types';
import { PasswordHasher } from './password-hasher';
import { type IssuedRefreshToken, RefreshTokenService } from './refresh-token.service';
import { TokenService } from './token.service';

const INVALID_CREDENTIALS = 'Invalid email or password';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  tenant: { id: string; name: string };
}

export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
  refreshToken: IssuedRefreshToken;
}

type UserWithTenant = User & { tenant: Tenant };

function toSessionUser(user: UserWithTenant): SessionUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    tenant: { id: user.tenant.id, name: user.tenant.name },
  };
}

function tenantSlug(propertyName: string): string {
  return `${slugify(propertyName) || 'riad'}-${randomBytes(3).toString('hex')}`;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly refreshTokens: RefreshTokenService,
    @Inject(APP_CONFIG) private readonly config: Pick<AppConfig, 'JWT_ACCESS_TTL_SECONDS'>,
  ) {}

  /** Creates a property (tenant) and its owner account, then opens a session. */
  async register(input: RegisterInput): Promise<AuthSession> {
    const passwordHash = await this.hasher.hash(input.password);
    try {
      const owner = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: { name: input.propertyName, slug: tenantSlug(input.propertyName) },
        });
        return tx.user.create({
          data: {
            tenantId: tenant.id,
            email: input.email,
            fullName: input.fullName,
            passwordHash,
            role: Role.OWNER,
          },
          include: { tenant: true },
        });
      });
      return await this.openSession(owner);
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Deliberately vague: the property owning this address is never disclosed.
        throw new ConflictException('An account already exists for this email address');
      }
      throw error;
    }
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { tenant: true },
    });
    if (!user?.isActive) {
      await this.hasher.verifyAgainstDummy(input.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (!(await this.hasher.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return this.openSession(user);
  }

  async refresh(presentedToken: string | undefined): Promise<AuthSession> {
    if (!presentedToken) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const { userId, refreshToken } = await this.refreshTokens.rotate(presentedToken);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    if (!user?.isActive) {
      await this.refreshTokens.revokeAllForUser(userId);
      throw new UnauthorizedException('Account disabled');
    }
    return this.sessionFor(user, refreshToken);
  }

  async logout(presentedToken: string | undefined): Promise<void> {
    if (presentedToken) {
      await this.refreshTokens.revoke(presentedToken);
    }
  }

  async me(caller: AuthUser): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: caller.userId },
      include: { tenant: true },
    });
    if (!user?.isActive) {
      throw new UnauthorizedException('Account disabled');
    }
    return toSessionUser(user);
  }

  private async openSession(user: UserWithTenant): Promise<AuthSession> {
    return this.sessionFor(user, await this.refreshTokens.issue(user.id));
  }

  private async sessionFor(
    user: UserWithTenant,
    refreshToken: IssuedRefreshToken,
  ): Promise<AuthSession> {
    const accessToken = await this.tokens.sign({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
    });
    return {
      accessToken,
      expiresIn: this.config.JWT_ACCESS_TTL_SECONDS,
      user: toSessionUser(user),
      refreshToken,
    };
  }
}
