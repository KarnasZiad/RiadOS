import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderScreen } from '../../../test/render';
import { ApiError } from '../../lib/api-client';
import { LoginPage } from './LoginPage';

const calendar = <p>Calendar screen</p>;

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('E-mail'), 'reception@riad-yasmine.ma');
  await user.type(screen.getByLabelText('Mot de passe'), 'correct horse battery');
  await user.click(screen.getByRole('button', { name: 'Se connecter' }));
}

describe('LoginPage', () => {
  it('logs in and opens the calendar', async () => {
    const login = vi.fn(() => Promise.resolve());
    renderScreen(<LoginPage />, {
      user: null,
      path: '/login',
      route: '/login',
      routes: { '/calendar': calendar },
      auth: { login },
    });

    await fillAndSubmit();

    expect(await screen.findByText('Calendar screen')).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith('reception@riad-yasmine.ma', 'correct horse battery');
  });

  it('goes back to the page that required authentication', async () => {
    renderScreen(<LoginPage />, {
      user: null,
      path: '/login',
      route: { pathname: '/login', state: { from: '/rooms' } },
      routes: { '/rooms': <p>Rooms screen</p> },
    });

    await fillAndSubmit();

    expect(await screen.findByText('Rooms screen')).toBeInTheDocument();
  });

  it('never redirects to another site after login', async () => {
    renderScreen(<LoginPage />, {
      user: null,
      path: '/login',
      route: { pathname: '/login', state: { from: '//evil.example/phishing' } },
      routes: { '/calendar': calendar },
    });

    await fillAndSubmit();

    expect(await screen.findByText('Calendar screen')).toBeInTheDocument();
  });

  it('explains wrong credentials', async () => {
    renderScreen(<LoginPage />, {
      user: null,
      path: '/login',
      route: '/login',
      auth: { login: vi.fn(() => Promise.reject(new ApiError(401, 'Invalid email or password'))) },
    });

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou mot de passe incorrect.');
  });

  it('explains rate limiting', async () => {
    renderScreen(<LoginPage />, {
      user: null,
      path: '/login',
      route: '/login',
      auth: { login: vi.fn(() => Promise.reject(new ApiError(429, 'Too Many Requests'))) },
    });

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de tentatives');
  });

  it('skips the form when a session is already open', () => {
    renderScreen(<LoginPage />, {
      path: '/login',
      route: '/login',
      routes: { '/calendar': calendar },
    });

    expect(screen.getByText('Calendar screen')).toBeInTheDocument();
  });
});
