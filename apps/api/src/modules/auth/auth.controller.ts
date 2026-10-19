import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { openApiSchema } from '../../common/openapi';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { REFRESH_COOKIE, refreshCookieOptions } from './auth.cookies';
import { type LoginInput, LoginSchema, type RegisterInput, RegisterSchema } from './auth.schemas';
import { type AuthSession, AuthService, type SessionUser } from './auth.service';
import type { AuthUser } from './auth.types';
import { CurrentUser, Public } from './decorators';

export interface SessionResponse {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
}

function readRefreshCookie(request: Request): string | undefined {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: Pick<AppConfig, 'COOKIE_SECURE'>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBody({ schema: openApiSchema(RegisterSchema) })
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) body: RegisterInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    return this.respond(await this.auth.register(body), res);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiBody({ schema: openApiSchema(LoginSchema) })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    return this.respond(await this.auth.login(body), res);
  }

  /** Authenticated by the httpOnly refresh cookie (SameSite=Strict protects it from CSRF). */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    try {
      return this.respond(await this.auth.refresh(readRefreshCookie(req)), res);
    } catch (error) {
      res.clearCookie(REFRESH_COOKIE, refreshCookieOptions(this.config.COOKIE_SECURE));
      throw error;
    }
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readRefreshCookie(req));
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions(this.config.COOKIE_SECURE));
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<SessionUser> {
    return this.auth.me(user);
  }

  private respond(session: AuthSession, res: Response): SessionResponse {
    res.cookie(
      REFRESH_COOKIE,
      session.refreshToken.token,
      refreshCookieOptions(this.config.COOKIE_SECURE, session.refreshToken.expiresAt),
    );
    return { accessToken: session.accessToken, expiresIn: session.expiresIn, user: session.user };
  }
}
