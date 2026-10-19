import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type AccessTokenPayload, AccessTokenPayloadSchema, type AuthUser } from './auth.types';

export const JWT_ISSUER = 'riados-api';
export const JWT_AUDIENCE = 'riados-web';

/** Short-lived access tokens (HS256). Their claims are validated again after signature checks. */
@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  sign(user: AuthUser): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.userId, tid: user.tenantId, role: user.role };
    return this.jwt.signAsync(payload);
  }

  async verify(token: string): Promise<AuthUser> {
    let decoded: unknown;
    try {
      decoded = await this.jwt.verifyAsync<Record<string, unknown>>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const payload = AccessTokenPayloadSchema.safeParse(decoded);
    if (!payload.success) {
      throw new UnauthorizedException('Invalid access token');
    }
    return { userId: payload.data.sub, tenantId: payload.data.tid, role: payload.data.role };
  }
}
