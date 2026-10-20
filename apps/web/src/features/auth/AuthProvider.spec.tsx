import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi, requestedUrls, userWithRole } from '../../../test/render';
import type { ApiClient } from '../../lib/api-client';
import { ApiContext } from '../../lib/api-context';
import { useAuth } from './auth-context';
import { AuthProvider } from './AuthProvider';

const session = { accessToken: 'token', expiresIn: 900, user: userWithRole('OWNER') };

function SessionProbe({ client }: { client: ApiClient }) {
  const { state, login, logout } = useAuth();
  return (
    <div>
      <p>
        {state.status === 'authenticated' ? `connected as ${state.user.fullName}` : state.status}
      </p>
      <button type="button" onClick={() => void login('owner@riad-yasmine.ma', 'secret')}>
        login
      </button>
      <button type="button" onClick={() => void logout()}>
        logout
      </button>
      <button type="button" onClick={() => void client.get('/rooms').catch(() => undefined)}>
        load rooms
      </button>
    </div>
  );
}

function renderProvider(client: ApiClient) {
  return render(
    <ApiContext value={client}>
      <AuthProvider>
        <SessionProbe client={client} />
      </AuthProvider>
    </ApiContext>,
  );
}

describe('AuthProvider', () => {
  it('restores the session from the refresh cookie', async () => {
    const { client } = fakeApi(({ url }) =>
      url.pathname === '/api/auth/refresh' ? [200, session] : [404],
    );

    renderProvider(client);

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByText('connected as Youssef Alaoui')).toBeInTheDocument();
  });

  it('is anonymous without a valid refresh cookie, then logs in and out', async () => {
    const { client, fetchMock } = fakeApi(({ url }) => {
      if (url.pathname === '/api/auth/login') return [200, session];
      if (url.pathname === '/api/auth/logout') return [204];
      return [401];
    });
    const user = userEvent.setup();
    renderProvider(client);
    expect(await screen.findByText('anonymous')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'login' }));
    expect(await screen.findByText('connected as Youssef Alaoui')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'logout' }));
    expect(await screen.findByText('anonymous')).toBeInTheDocument();
    expect(requestedUrls(fetchMock)).toContain('/api/auth/logout');
  });

  it('falls back to anonymous when the session expires during use', async () => {
    let refreshes = 0;
    const { client } = fakeApi(({ url }) => {
      if (url.pathname === '/api/auth/refresh') {
        refreshes += 1;
        return refreshes === 1 ? [200, session] : [401];
      }
      return [401];
    });
    const user = userEvent.setup();
    renderProvider(client);
    await screen.findByText('connected as Youssef Alaoui');

    await user.click(screen.getByRole('button', { name: 'load rooms' }));

    await waitFor(() => {
      expect(screen.getByText('anonymous')).toBeInTheDocument();
    });
  });
});
