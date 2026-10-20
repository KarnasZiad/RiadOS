import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '../../lib/api-context';
import type { SessionResponse } from '../../lib/types';
import { AuthContext, type AuthContextValue, type AuthState } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useApi();
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    client.onSessionExpired(() => {
      setState({ status: 'anonymous' });
    });
    // Restores the session from the httpOnly refresh cookie after a page reload.
    void client.refresh().then((session) => {
      if (active) {
        setState(
          session ? { status: 'authenticated', user: session.user } : { status: 'anonymous' },
        );
      }
    });
    return () => {
      active = false;
    };
  }, [client]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await client.post<SessionResponse>('/auth/login', { email, password });
      client.setAccessToken(session.accessToken);
      setState({ status: 'authenticated', user: session.user });
    },
    [client],
  );

  const logout = useCallback(async () => {
    try {
      await client.post('/auth/logout');
    } finally {
      client.setAccessToken(null);
      setState({ status: 'anonymous' });
    }
  }, [client]);

  const value = useMemo<AuthContextValue>(() => ({ state, login, logout }), [state, login, logout]);

  return <AuthContext value={value}>{children}</AuthContext>;
}
