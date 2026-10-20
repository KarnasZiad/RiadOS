import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Alert, Badge, type BadgeTone, Spinner } from '../../components/ui/feedback';
import { useApi } from '../../lib/api-context';
import { addMonths, startOfMonth, todayIso } from '../../lib/dates';
import { describeError } from '../../lib/errors';
import { formatMoney, formatShortDate, STATUS_LABELS } from '../../lib/format';
import type { ReservationPage, ReservationStatus } from '../../lib/types';
import { canBook, useCurrentUser } from '../auth/auth-context';

export const PAGE_SIZE = 20;

const STATUS_TONES: Record<ReservationStatus, BadgeTone> = {
  CONFIRMED: 'brand',
  CHECKED_IN: 'success',
  CHECKED_OUT: 'neutral',
  CANCELLED: 'muted',
};

const monthFormat = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function ReservationsPage() {
  const client = useApi();
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => startOfMonth(todayIso()));
  const nextMonth = addMonths(month, 1);

  const reservations = useInfiniteQuery({
    queryKey: ['reservations', month],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ from: month, to: nextMonth, limit: String(PAGE_SIZE) });
      if (pageParam) params.set('cursor', pageParam);
      return client.get<ReservationPage>(`/reservations?${params.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => client.post(`/reservations/${id}/cancel`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reservations'] }),
        queryClient.invalidateQueries({ queryKey: ['availability'] }),
      ]);
    },
  });

  const items = reservations.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Réservations</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Mois précédent"
            onClick={() => {
              setMonth(addMonths(month, -1));
            }}
          >
            <ChevronLeft aria-hidden className="h-4 w-4" />
          </Button>
          <span className="min-w-36 text-center text-sm font-medium capitalize">
            {monthFormat.format(new Date(`${month}T00:00:00Z`))}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Mois suivant"
            onClick={() => {
              setMonth(nextMonth);
            }}
          >
            <ChevronRight aria-hidden className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {reservations.isError ? <Alert>{describeError(reservations.error)}</Alert> : null}
      {cancel.isError ? <Alert>{describeError(cancel.error)}</Alert> : null}
      {reservations.isPending ? <Spinner /> : null}

      {reservations.data ? (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="p-3 font-medium">Client</th>
                <th className="p-3 font-medium">Chambre</th>
                <th className="p-3 font-medium">Séjour</th>
                <th className="p-3 font-medium">Statut</th>
                <th className="p-3 text-right font-medium">Total</th>
                <th className="p-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((reservation) => (
                <tr key={reservation.id} className="border-t border-stone-100">
                  <td className="p-3 font-medium">{reservation.guest.fullName}</td>
                  <td className="p-3">{reservation.room.name}</td>
                  <td className="p-3">
                    {formatShortDate(reservation.checkIn)} → {formatShortDate(reservation.checkOut)}
                    <span className="ml-1 text-stone-500">
                      ({reservation.nights} nuit{reservation.nights > 1 ? 's' : ''})
                    </span>
                  </td>
                  <td className="p-3">
                    <Badge tone={STATUS_TONES[reservation.status]}>
                      {STATUS_LABELS[reservation.status]}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    {formatMoney(reservation.totalCents, reservation.currency)}
                  </td>
                  <td className="p-3 text-right">
                    {canBook(user.role) && reservation.status === 'CONFIRMED' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={cancel.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Annuler la réservation de ${reservation.guest.fullName} ?`,
                            )
                          ) {
                            cancel.mutate(reservation.id);
                          }
                        }}
                      >
                        Annuler
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-stone-500">Aucune réservation ce mois-ci.</p>
          ) : null}
        </div>
      ) : null}

      {reservations.hasNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          disabled={reservations.isFetchingNextPage}
          onClick={() => void reservations.fetchNextPage()}
        >
          {reservations.isFetchingNextPage ? 'Chargement…' : 'Afficher plus'}
        </Button>
      ) : null}
    </section>
  );
}
