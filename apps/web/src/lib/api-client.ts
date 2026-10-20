import type { SessionResponse } from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function messageOf(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const { message } = body;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');
  }
  return undefined;
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, messageOf(body) ?? response.statusText, body);
  }
  return body as T;
}

/**
 * HTTP client of the SPA (ADR 0004).
 *
 * The access token lives in memory only, never in localStorage where any XSS could read it. On a
 * 401 the client refreshes once through the httpOnly cookie and replays the request. Concurrent
 * refreshes are merged: two parallel rotations of the same refresh token would look like a replay
 * attack to the API and revoke the session.
 */
export class ApiClient {
  private accessToken: string | null = null;
  private refreshing: Promise<SessionResponse | null> | null = null;
  private sessionExpiredListener: (() => void) | undefined;

  constructor(
    private readonly baseUrl = '/api',
    private readonly fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  onSessionExpired(listener: () => void): void {
    this.sessionExpiredListener = listener;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
  }

  refresh(): Promise<SessionResponse | null> {
    this.refreshing ??= this.send('/auth/refresh', { method: 'POST' })
      .then(async (response) => {
        if (!response.ok) {
          this.accessToken = null;
          return null;
        }
        const session = (await response.json()) as SessionResponse;
        this.accessToken = session.accessToken;
        return session;
      })
      .catch(() => {
        this.accessToken = null;
        return null;
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.send(path, init);
    if (response.status === 401 && !path.startsWith('/auth/')) {
      const session = await this.refresh();
      if (session) {
        return parse<T>(await this.send(path, init));
      }
      this.sessionExpiredListener?.();
    }
    return parse<T>(response);
  }

  private send(path: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }
    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }
    return this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: 'same-origin',
    });
  }
}

export const api = new ApiClient();
