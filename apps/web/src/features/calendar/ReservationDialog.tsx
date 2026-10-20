import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type SubmitEvent, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { Alert } from '../../components/ui/feedback';
import { Field, Input, Label } from '../../components/ui/form';
import { useApi } from '../../lib/api-context';
import { addDays } from '../../lib/dates';
import { describeError, textField } from '../../lib/errors';
import { formatShortDate } from '../../lib/format';
import type { NewReservation, Reservation, RoomAvailability } from '../../lib/types';

const ERRORS = {
  409: 'Cette chambre est déjà réservée sur une partie de ces nuits.',
  422: 'Cette réservation dépasse la capacité de la chambre ou la durée maximale de séjour.',
};

export interface ReservationDialogProps {
  room: RoomAvailability;
  checkIn: string;
  onClose: () => void;
}

export function ReservationDialog({ room, checkIn, onClose }: ReservationDialogProps) {
  const client = useApi();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: NewReservation) => client.post<Reservation>('/reservations', input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['availability'] }),
        queryClient.invalidateQueries({ queryKey: ['reservations'] }),
      ]);
      onClose();
    },
  });

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = textField(form, 'email');
    mutation.mutate({
      roomId: room.id,
      checkIn,
      checkOut: textField(form, 'checkOut'),
      adults: Number(textField(form, 'adults')),
      children: Number(textField(form, 'children')),
      guest: { fullName: textField(form, 'guestName'), ...(email ? { email } : {}) },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-title"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 id="reservation-title" className="text-lg font-semibold">
          Nouvelle réservation · {room.name}
        </h2>
        <p className="mb-4 text-sm text-stone-500">Arrivée le {formatShortDate(checkIn)}</p>

        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <Field className="col-span-2">
            <Label htmlFor="guestName">Nom du client</Label>
            <Input
              id="guestName"
              name="guestName"
              required
              minLength={2}
              maxLength={120}
              autoFocus
            />
          </Field>
          <Field className="col-span-2">
            <Label htmlFor="email">E-mail (facultatif)</Label>
            <Input id="email" name="email" type="email" />
          </Field>
          <Field className="col-span-2">
            <Label htmlFor="checkOut">Départ</Label>
            <Input
              id="checkOut"
              name="checkOut"
              type="date"
              required
              min={addDays(checkIn, 1)}
              defaultValue={addDays(checkIn, 1)}
            />
          </Field>
          <Field>
            <Label htmlFor="adults">Adultes</Label>
            <Input
              id="adults"
              name="adults"
              type="number"
              min={1}
              max={room.capacity}
              defaultValue={1}
            />
          </Field>
          <Field>
            <Label htmlFor="children">Enfants</Label>
            <Input
              id="children"
              name="children"
              type="number"
              min={0}
              max={room.capacity}
              defaultValue={0}
            />
          </Field>

          {mutation.isError ? (
            <Alert className="col-span-2">{describeError(mutation.error, ERRORS)}</Alert>
          ) : null}

          <div className="col-span-2 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Enregistrement…' : 'Réserver'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
