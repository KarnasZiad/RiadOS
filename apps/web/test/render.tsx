import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../src/features/auth/auth-context';
import { ApiClient } from '../src/lib/api-client';
import { ApiContext } from '../src/lib/api-context';
import type { Role, SessionUser } from '../src/lib/types';

export function userWithRole(role: Role): SessionUser {
  return {
    id: 'user-1',
    email: 'staff@riad-yasmine.ma',
    fullName: 'Youssef Alaoui',
    role,
    tenant: { id: 'tenant-1', name: 'Riad Yasmine' },
  };
}

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

export function requestUrl(input: RequestInfo | URL | undefined): string {
  if (input === undefined) return '';
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.toString() : input.url;
}

/** URLs requested so far, in order. */
export function requestedUrls(fetchMock: FetchMock): string[] {
  return fetchMock.mock.calls.map(([input]) => requestUrl(input));
}

/** JSON body of the first request sent with this method. */
export function sentBody(fetchMock: FetchMock, method: string): unknown {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === method);
  const body = call?.[1]?.body;
  return typeof body === 'string' ? JSON.parse(body) : undefined;
}

export function defined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Expected a value');
  return value;
}

type Handler = (request: { method: string; url: URL; body: unknown }) => [number, unknown?];

/** Fake API: every call goes through the handler, which returns [status, json body]. */
export function fakeApi(handler: Handler) {
  const fetchMock = vi.fn<typeof fetch>((input, init) => {
    const url = new URL(requestUrl(input), 'http://localhost');
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    const [status, json] = handler({ method: init?.method ?? 'GET', url, body });
    return Promise.resolve(
      new Response(status === 204 ? null : JSON.stringify(json ?? {}), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  return { client: new ApiClient('/api', fetchMock), fetchMock };
}

interface Options {
  client?: ApiClient;
  user?: SessionUser | null;
  route?: string | { pathname: string; state?: unknown };
  /** Extra routes rendered next to the screen, to assert navigations. */
  routes?: Record<string, ReactElement>;
  path?: string;
  auth?: Partial<AuthContextValue>;
}

export function renderScreen(ui: ReactElement, options: Options = {}) {
  const {
    client = fakeApi(() => [404]).client,
    user = userWithRole('RECEPTION'),
    route = '/',
    routes = {},
    path = '*',
  } = options;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const auth: AuthContextValue = {
    state: user ? { status: 'authenticated', user } : { status: 'anonymous' },
    login: vi.fn(() => Promise.resolve()),
    logout: vi.fn(() => Promise.resolve()),
    ...options.auth,
  };

  const result = render(
    <QueryClientProvider client={queryClient}>
      <ApiContext value={client}>
        <AuthContext value={auth}>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path={path} element={ui} />
              {Object.entries(routes).map(([routePath, element]) => (
                <Route key={routePath} path={routePath} element={element} />
              ))}
            </Routes>
          </MemoryRouter>
        </AuthContext>
      </ApiContext>
    </QueryClientProvider>,
  );
  return { ...result, auth, queryClient };
}
