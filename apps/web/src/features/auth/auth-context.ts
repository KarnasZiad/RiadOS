import { createContext, use } from 'react';
import type { Role, SessionUser } from '../../lib/types';

export type AuthState =
  { status: 'loading' } | { status: 'anonymous' } | { status: 'authenticated'; user: SessionUser };

export interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return value;
}

/** For screens behind <RequireAuth>, where a user is always present. */
export function useCurrentUser(): SessionUser {
  const { state } = useAuth();
  if (state.status !== 'authenticated') {
    throw new Error('useCurrentUser requires an authenticated session');
  }
  return state.user;
}

/** Mirrors the API rules: housekeeping can see the calendar but not book. */
export function canBook(role: Role): boolean {
  return role === 'OWNER' || role === 'RECEPTION';
}
