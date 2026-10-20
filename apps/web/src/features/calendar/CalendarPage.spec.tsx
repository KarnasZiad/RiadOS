import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeApi, renderScreen, requestedUrls, sentBody, userWithRole } from '../../../test/render';
import type { Availability } from '../../lib/types';
import { CalendarPage } from './CalendarPage';

const availability: Availability = {
  from: '2026-10-20',
  to: '2026-11-03',
  rooms: [{ id: 'atlas', name: 'Atlas', capacity: 2, reservations: [] }],
};

describe('CalendarPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 20, 9, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the next 14 nights and moves week by week', async () => {
    const { client, fetchMock } = fakeApi(() => [200, availability]);
    renderScreen(<CalendarPage />, { client });

    expect(await screen.findByText('Atlas')).toBeInTheDocument();
    expect(requestedUrls(fetchMock)[0]).toBe('/api/availability?from=2026-10-20&to=2026-11-03');

    await userEvent.click(screen.getByRole('button', { name: 'Semaine suivante' }));
    await waitFor(() => {
      expect(requestedUrls(fetchMock).at(-1)).toBe(
        '/api/availability?from=2026-10-27&to=2026-11-10',
      );
    });

    await userEvent.click(screen.getByRole('button', { name: 'Semaine précédente' }));
    await userEvent.click(screen.getByRole('button', { name: 'Semaine précédente' }));
    await userEvent.click(screen.getByRole('button', { name: "Aujourd'hui" }));
    expect(screen.getByText('20 oct. – 2 nov.')).toBeInTheDocument();
  });

  it('books a free night from the calendar', async () => {
    const user = userEvent.setup();
    const { client, fetchMock } = fakeApi(({ method, url }) =>
      method === 'POST' && url.pathname === '/api/reservations'
        ? [201, { id: 'r1' }]
        : [200, availability],
    );
    renderScreen(<CalendarPage />, { client });

    await user.click(await screen.findByRole('button', { name: 'Réserver Atlas le 22 oct.' }));
    const dialog = screen.getByRole('dialog', { name: 'Nouvelle réservation · Atlas' });
    await user.type(screen.getByLabelText('Nom du client'), 'Sara El Idrissi');
    await user.type(screen.getByLabelText('E-mail (facultatif)'), 'sara@example.com');
    await user.clear(screen.getByLabelText('Adultes'));
    await user.type(screen.getByLabelText('Adultes'), '2');
    await user.click(screen.getByRole('button', { name: 'Réserver' }));

    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
    });
    expect(sentBody(fetchMock, 'POST')).toEqual({
      roomId: 'atlas',
      checkIn: '2026-10-22',
      checkOut: '2026-10-23',
      adults: 2,
      children: 0,
      guest: { fullName: 'Sara El Idrissi', email: 'sara@example.com' },
    });
  });

  it('explains a booking conflict and keeps the dialog open', async () => {
    const user = userEvent.setup();
    const { client } = fakeApi(({ method }) =>
      method === 'POST' ? [409, { message: 'This room is already booked' }] : [200, availability],
    );
    renderScreen(<CalendarPage />, { client });

    await user.click(await screen.findByRole('button', { name: 'Réserver Atlas le 22 oct.' }));
    await user.type(screen.getByLabelText('Nom du client'), 'Sara El Idrissi');
    await user.click(screen.getByRole('button', { name: 'Réserver' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cette chambre est déjà réservée sur une partie de ces nuits.',
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is read-only for housekeeping', async () => {
    const { client } = fakeApi(() => [200, availability]);
    renderScreen(<CalendarPage />, { client, user: userWithRole('HOUSEKEEPING') });

    expect(await screen.findByText('Atlas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Réserver Atlas/ })).toBeNull();
  });

  it('reports a loading failure', async () => {
    const { client } = fakeApi(() => [500]);
    renderScreen(<CalendarPage />, { client });

    expect(await screen.findByRole('alert')).toHaveTextContent('Une erreur est survenue.');
  });
});
