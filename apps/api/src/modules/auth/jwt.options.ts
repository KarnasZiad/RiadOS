import type { JwtModuleOptions } from '@nestjs/jwt';
import type { AppConfig } from '../../config/app-config';
import { JWT_AUDIENCE, JWT_ISSUER } from './token.service';

export function jwtOptions(
  config: Pick<AppConfig, 'JWT_ACCESS_SECRET' | 'JWT_ACCESS_TTL_SECONDS'>,
): JwtModuleOptions {
  return {
    secret: config.JWT_ACCESS_SECRET,
    signOptions: {
      algorithm: 'HS256',
      expiresIn: config.JWT_ACCESS_TTL_SECONDS,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    },
    // Pinning the algorithm prevents "alg: none" and algorithm confusion attacks.
    verifyOptions: { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
  };
}
