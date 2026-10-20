import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { userWithRole } from '../../../test/render';
import { AuthContext, type AuthState } from './auth-context';
import { RequireAuth } from './RequireAuth';

function LoginProbe() {
  const location = useLocation();
  return <p>login page, from {(location.state as { from?: string } | null)?.from}</p>;
}

function renderWith(state: AuthState) {
  return render(
    <AuthContext value={{ state, login: vi.fn(), logout: vi.fn() }}>
      <MemoryRouter initialEntries={['/rooms']}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route element={<RequireAuth />}>
            <Route path="/rooms" element={<p>rooms page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext>,
  );
}

describe('RequireAuth', () => {
  it('waits while the session is being restored', () => {
    renderWith({ status: 'loading' });

    expect(screen.getByRole('status')).toHaveTextContent('Ouverture de la session');
  });

  it('sends anonymous visitors to the login page and remembers where they were going', () => {
    renderWith({ status: 'anonymous' });

    expect(screen.getByText('login page, from /rooms')).toBeInTheDocument();
  });

  it('renders the protected screen for an authenticated user', () => {
    renderWith({ status: 'authenticated', user: userWithRole('OWNER') });

    expect(screen.getByText('rooms page')).toBeInTheDocument();
  });
});
