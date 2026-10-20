import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeApi, renderScreen, requestedUrls, userWithRole } from '../../../test/render';
import type { Reservation } from '../../lib/types';
import { ReservationsPage } from './ReservationsPage';

function reservation(id: string, guest: string, status: Reservation['status'] = 'CONFIRMED') {
  return {
    id,
    room: { id: 'atlas', name: 'Atlas' },
    guest: { id: `g-${id}`, fullName: guest },
    checkIn: '2026-10-20',
    checkOut: '2026-10-23',
    nights: 3,
    status,
    source: 'DIRECT',
    adults: 2,
    children: 0,
    totalCents: 255_000,
    currency: 'MAD',
    notes: null,
    createdAt: '2026-10-19T10:00:00Z',
  } satisfies Reservation;
}

describe('ReservationsPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 20, 9, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists the reservations of the month and loads more with the cursor', async () => {
    const user = userEvent.setup();
    const { client, fetchMock } = fakeApi(({ url }) =>
      url.searchParams.get('cursor') === 'next-page'
        ? [200, { items: [reservation('r2', 'Lucas Martin')], nextCursor: null }]
        : [200, { items: [reservation('r1', 'Sara El Idrissi')], nextCursor: 'next-page' }],
    );
    renderScreen(<ReservationsPage />, { client });

    expect(await screen.findByText('Sara El Idrissi')).toBeInTheDocument();
    expect(screen.getByText('(3 nuits)')).toBeInTheDocument();
    expect(requestedUrls(fetchMock)[0]).toBe(
      '/api/reservations?from=2026-10-01&to=2026-11-01&limit=20',
    );

    await user.click(screen.getByRole('button', { name: 'Afficher plus' }));

    expect(await screen.findByText('Lucas Martin')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Afficher plus' })).toBeNull();
  });

  it('cancels a confirmed reservation after confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { client, fetchMock } = fakeApi(({ method }) =>
      method === 'POST'
        ? [200, reservation('r1', 'Sara El Idrissi', 'CANCELLED')]
        : [200, { items: [reservation('r1', 'Sara El Idrissi')], nextCursor: null }],
    );
    renderScreen(<ReservationsPage />, { client });

    await user.click(await screen.findByRole('button', { name: 'Annuler' }));

    await waitFor(() => {
      expect(requestedUrls(fetchMock)).toContain('/api/reservations/r1/cancel');
    });
  });

  it('does not offer cancellation to housekeeping or on cancelled stays', async () => {
    const { client } = fakeApi(() => [
      200,
      { items: [reservation('r1', 'Sara El Idrissi', 'CANCELLED')], nextCursor: null },
    ]);
    renderScreen(<ReservationsPage />, { client, user: userWithRole('HOUSEKEEPING') });

    expect(await screen.findByText('Annulée')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull();
  });

  it('navigates between months', async () => {
    const user = userEvent.setup();
    const { client, fetchMock } = fakeApi(() => [200, { items: [], nextCursor: null }]);
    renderScreen(<ReservationsPage />, { client });
    expect(await screen.findByText('Aucune réservation ce mois-ci.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mois suivant' }));
    await waitFor(() => {
      expect(requestedUrls(fetchMock).at(-1)).toContain('from=2026-11-01&to=2026-12-01');
    });

    await user.click(screen.getByRole('button', { name: 'Mois précédent' }));
    expect(screen.getByText('octobre 2026')).toBeInTheDocument();
  });
});
