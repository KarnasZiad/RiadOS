import type { CookieOptions } from 'express';

export const REFRESH_COOKIE = 'riados_rt';

/** The refresh cookie is only sent to the auth endpoints, never to the rest of the API. */
const REFRESH_COOKIE_PATH = '/api/auth';

export function refreshCookieOptions(secure: boolean, expires?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    ...(expires ? { expires } : {}),
  };
}
