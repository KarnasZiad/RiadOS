import type { CSSProperties } from 'react';
import { isNightFree, placeStay } from '../../lib/calendar';
import { isWeekend, todayIso } from '../../lib/dates';
import { formatShortDate, formatWeekday } from '../../lib/format';
import type { RoomAvailability } from '../../lib/types';
import { cn } from '../../lib/utils';

export interface CalendarGridProps {
  days: readonly string[];
  rooms: readonly RoomAvailability[];
  /** Called when a free night is selected. Without it, the grid is read-only. */
  onSelect?: (room: RoomAvailability, date: string) => void;
}

export function CalendarGrid({ days, rooms, onSelect }: CalendarGridProps) {
  const today = todayIso();
  const columns: CSSProperties = {
    gridTemplateColumns: `10rem repeat(${days.length}, minmax(3.25rem, 1fr))`,
  };

  return (
    <div
      role="grid"
      aria-label="Disponibilités des chambres"
      className="overflow-x-auto overflow-y-hidden rounded-xl border border-stone-200 bg-white"
    >
      <div
        role="row"
        className="grid border-b border-stone-200 bg-stone-50 text-xs"
        style={columns}
      >
        <div role="columnheader" className="p-2 font-medium text-stone-600">
          Chambre
        </div>
        {days.map((day) => (
          <div
            role="columnheader"
            key={day}
            className={cn(
              'p-2 text-center text-stone-500',
              isWeekend(day) && 'bg-brand-50',
              day === today && 'font-semibold text-brand-700',
            )}
          >
            <span className="block capitalize">{formatWeekday(day)}</span>
            <span className="block">{formatShortDate(day)}</span>
          </div>
        ))}
      </div>

      {rooms.length === 0 ? (
        <p className="p-6 text-center text-sm text-stone-500">Aucune chambre active.</p>
      ) : (
        rooms.map((room) => (
          <div
            role="row"
            key={room.id}
            className="grid border-b border-stone-100 last:border-b-0"
            style={columns}
          >
            <div
              role="rowheader"
              className="flex flex-col justify-center p-2"
              style={{ gridRow: 1 }}
            >
              <span className="text-sm font-medium">{room.name}</span>
              <span className="text-xs text-stone-500">{room.capacity} pers.</span>
            </div>

            {days.map((day, index) => (
              <div
                role="gridcell"
                key={day}
                className={cn('h-14 border-l border-stone-100', isWeekend(day) && 'bg-brand-50/40')}
                style={{ gridColumn: index + 2, gridRow: 1 }}
              >
                {onSelect && isNightFree(room.reservations, day) ? (
                  <button
                    type="button"
                    aria-label={`Réserver ${room.name} le ${formatShortDate(day)}`}
                    className="h-full w-full hover:bg-zellige-100 focus-visible:bg-zellige-100 focus-visible:outline-none"
                    onClick={() => {
                      onSelect(room, day);
                    }}
                  />
                ) : null}
              </div>
            ))}

            {room.reservations.map((reservation) => {
              const placement = placeStay(reservation, days[0] ?? today, days.length);
              if (!placement) return null;
              return (
                <div
                  key={reservation.id}
                  title={`${reservation.guestName} · ${reservation.checkIn} → ${reservation.checkOut}`}
                  className={cn(
                    'z-10 m-1 self-center truncate rounded-md px-2 py-1.5 text-xs font-medium text-white shadow-sm',
                    reservation.status === 'CHECKED_IN' ? 'bg-zellige-500' : 'bg-brand-600',
                    placement.startsBefore && 'ml-0 rounded-l-none',
                    placement.endsAfter && 'mr-0 rounded-r-none',
                  )}
                  style={{
                    gridColumn: `${placement.offset + 2} / span ${placement.span}`,
                    gridRow: 1,
                  }}
                >
                  {reservation.guestName}
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
