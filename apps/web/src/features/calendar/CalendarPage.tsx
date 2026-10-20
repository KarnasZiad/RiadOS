import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Alert, Spinner } from '../../components/ui/feedback';
import { useApi } from '../../lib/api-context';
import { addDays, dateRange, todayIso } from '../../lib/dates';
import { describeError } from '../../lib/errors';
import { formatShortDate } from '../../lib/format';
import type { Availability, RoomAvailability } from '../../lib/types';
import { canBook, useCurrentUser } from '../auth/auth-context';
import { CalendarGrid } from './CalendarGrid';
import { ReservationDialog } from './ReservationDialog';

export const CALENDAR_DAYS = 14;
const STEP_DAYS = 7;

export function CalendarPage() {
  const client = useApi();
  const user = useCurrentUser();
  const [start, setStart] = useState(() => todayIso());
  const [selection, setSelection] = useState<{ room: RoomAvailability; date: string } | null>(null);

  const end = addDays(start, CALENDAR_DAYS);
  const days = useMemo(() => dateRange(start, CALENDAR_DAYS), [start]);
  const availability = useQuery({
    queryKey: ['availability', start],
    queryFn: () => client.get<Availability>(`/availability?from=${start}&to=${end}`),
    placeholderData: keepPreviousData,
  });

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Calendrier</h1>
        <span className="text-sm text-stone-500">
          {formatShortDate(start)} – {formatShortDate(addDays(end, -1))}
        </span>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Semaine précédente"
            onClick={() => {
              setStart(addDays(start, -STEP_DAYS));
            }}
          >
            <ChevronLeft aria-hidden className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setStart(todayIso());
            }}
          >
            Aujourd&apos;hui
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Semaine suivante"
            onClick={() => {
              setStart(addDays(start, STEP_DAYS));
            }}
          >
            <ChevronRight aria-hidden className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {canBook(user.role) ? (
        <p className="text-sm text-stone-500">
          Cliquez sur une nuit libre pour créer une réservation.
        </p>
      ) : null}

      {availability.isError ? <Alert>{describeError(availability.error)}</Alert> : null}

      {availability.data ? (
        <CalendarGrid
          days={days}
          rooms={availability.data.rooms}
          {...(canBook(user.role)
            ? {
                onSelect: (room: RoomAvailability, date: string) => {
                  setSelection({ room, date });
                },
              }
            : {})}
        />
      ) : availability.isPending ? (
        <Spinner />
      ) : null}

      {selection ? (
        <ReservationDialog
          room={selection.room}
          checkIn={selection.date}
          onClose={() => {
            setSelection(null);
          }}
        />
      ) : null}
    </section>
  );
}
