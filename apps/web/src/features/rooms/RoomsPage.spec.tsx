import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi, renderScreen, sentBody, userWithRole } from '../../../test/render';
import type { Room } from '../../lib/types';
import { RoomsPage } from './RoomsPage';

const rooms: Room[] = [
  { id: 'atlas', name: 'Atlas', capacity: 2, baseRateCents: 85_000, isActive: true },
  { id: 'ourika', name: 'Ourika', capacity: 2, baseRateCents: 75_000, isActive: false },
];

describe('RoomsPage', () => {
  it('lists the rooms with their rate and status', async () => {
    const { client } = fakeApi(() => [200, rooms]);
    renderScreen(<RoomsPage />, { client });

    expect(await screen.findByText('Atlas')).toBeInTheDocument();
    expect(screen.getByText(/850,00/)).toBeInTheDocument();
    expect(screen.getByText('Hors service')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ajouter une chambre' })).toBeNull();
  });

  it('lets the owner add a room, with the rate converted to cents', async () => {
    const user = userEvent.setup();
    const { client, fetchMock } = fakeApi(({ method }) =>
      method === 'POST' ? [201, rooms[0]] : [200, []],
    );
    renderScreen(<RoomsPage />, { client, user: userWithRole('OWNER') });
    expect(await screen.findByText('Aucune chambre pour le moment.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nom'), 'Atlas');
    await user.clear(screen.getByLabelText('Capacité'));
    await user.type(screen.getByLabelText('Capacité'), '3');
    await user.type(screen.getByLabelText('Tarif par nuit (MAD)'), '850,50');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    await waitFor(() => {
      expect(sentBody(fetchMock, 'POST')).toEqual({
        name: 'Atlas',
        capacity: 3,
        baseRateCents: 85_050,
      });
    });
  });

  it('refuses an invalid rate without calling the API', async () => {
    const user = userEvent.setup();
    const { client, fetchMock } = fakeApi(() => [200, []]);
    renderScreen(<RoomsPage />, { client, user: userWithRole('OWNER') });

    await user.type(screen.getByLabelText('Nom'), 'Atlas');
    await user.type(screen.getByLabelText('Tarif par nuit (MAD)'), 'gratuit');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Le tarif doit être un montant');
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('explains a duplicate room name', async () => {
    const user = userEvent.setup();
    const { client } = fakeApi(({ method }) => (method === 'POST' ? [409, {}] : [200, rooms]));
    renderScreen(<RoomsPage />, { client, user: userWithRole('OWNER') });

    await user.type(screen.getByLabelText('Nom'), 'Atlas');
    await user.type(screen.getByLabelText('Tarif par nuit (MAD)'), '850');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Une chambre porte déjà ce nom.');
  });
});
