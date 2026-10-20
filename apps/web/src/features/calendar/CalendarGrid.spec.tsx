import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { defined } from '../../../test/render';
import { dateRange } from '../../lib/dates';
import type { RoomAvailability } from '../../lib/types';
import { CalendarGrid } from './CalendarGrid';

const days = dateRange('2026-10-20', 7);
const rooms: RoomAvailability[] = [
  {
    id: 'atlas',
    name: 'Atlas',
    capacity: 2,
    reservations: [
      {
        id: 'r1',
        guestName: 'Sara El Idrissi',
        checkIn: '2026-10-21',
        checkOut: '2026-10-23',
        status: 'CONFIRMED',
      },
    ],
  },
  { id: 'toubkal', name: 'Toubkal', capacity: 3, reservations: [] },
];

describe('CalendarGrid', () => {
  it('shows one row per room and the reservations as bars', () => {
    render(<CalendarGrid days={days} rooms={rooms} />);

    expect(screen.getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual([
      'Atlas2 pers.',
      'Toubkal3 pers.',
    ]);
    const bar = screen.getByText('Sara El Idrissi');
    expect(bar).toHaveStyle({ gridColumn: '3 / span 2' });
    expect(bar).toHaveAttribute('title', 'Sara El Idrissi · 2026-10-21 → 2026-10-23');
  });

  it('only offers free nights for booking, the departure day included', async () => {
    const onSelect = vi.fn();
    render(<CalendarGrid days={days} rooms={rooms} onSelect={onSelect} />);
    const [atlasRow] = screen.getAllByRole('row').slice(1);

    // 7 nights minus 2 occupied ones.
    expect(within(defined(atlasRow)).getAllByRole('button')).toHaveLength(5);
    expect(screen.queryByRole('button', { name: 'Réserver Atlas le 21 oct.' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Réserver Atlas le 23 oct.' }));
    expect(onSelect).toHaveBeenCalledWith(rooms[0], '2026-10-23');
  });

  it('is read-only without a selection handler', () => {
    render(<CalendarGrid days={days} rooms={rooms} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('explains when there is no room', () => {
    render(<CalendarGrid days={days} rooms={[]} />);

    expect(screen.getByText('Aucune chambre active.')).toBeInTheDocument();
  });
});
