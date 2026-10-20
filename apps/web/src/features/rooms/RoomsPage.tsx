import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type SubmitEvent, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Alert, Badge, Card, Spinner } from '../../components/ui/feedback';
import { Field, Input, Label } from '../../components/ui/form';
import { useApi } from '../../lib/api-context';
import { describeError, textField } from '../../lib/errors';
import { formatMoney, parseMoneyInput } from '../../lib/format';
import type { NewRoom, Room } from '../../lib/types';
import { useCurrentUser } from '../auth/auth-context';

export function RoomsPage() {
  const client = useApi();
  const user = useCurrentUser();
  const rooms = useQuery({ queryKey: ['rooms'], queryFn: () => client.get<Room[]>('/rooms') });

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Chambres</h1>

      {user.role === 'OWNER' ? <NewRoomForm /> : null}

      {rooms.isError ? <Alert>{describeError(rooms.error)}</Alert> : null}
      {rooms.isPending ? <Spinner /> : null}
      {rooms.data ? (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="p-3 font-medium">Chambre</th>
                <th className="p-3 font-medium">Capacité</th>
                <th className="p-3 font-medium">Tarif par nuit</th>
                <th className="p-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rooms.data.map((room) => (
                <tr key={room.id} className="border-t border-stone-100">
                  <td className="p-3 font-medium">{room.name}</td>
                  <td className="p-3">{room.capacity} pers.</td>
                  <td className="p-3">{formatMoney(room.baseRateCents)}</td>
                  <td className="p-3">
                    {room.isActive ? (
                      <Badge tone="success">Disponible</Badge>
                    ) : (
                      <Badge>Hors service</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rooms.data.length === 0 ? (
            <p className="p-6 text-center text-sm text-stone-500">Aucune chambre pour le moment.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function NewRoomForm() {
  const client = useApi();
  const queryClient = useQueryClient();
  const [invalidRate, setInvalidRate] = useState(false);
  const mutation = useMutation({
    mutationFn: (room: NewRoom) => client.post<Room>('/rooms', room),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rooms'] }),
        queryClient.invalidateQueries({ queryKey: ['availability'] }),
      ]);
    },
  });

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const baseRateCents = parseMoneyInput(textField(form, 'rate'));
    setInvalidRate(baseRateCents === null);
    if (baseRateCents === null) return;
    mutation.mutate(
      {
        name: textField(form, 'name'),
        capacity: Number(textField(form, 'capacity')),
        baseRateCents,
      },
      {
        onSuccess: () => {
          formElement.reset();
        },
      },
    );
  }

  return (
    <Card>
      <h2 className="mb-4 font-medium">Ajouter une chambre</h2>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-4 sm:items-end">
        <Field>
          <Label htmlFor="name">Nom</Label>
          <Input id="name" name="name" required maxLength={60} placeholder="Atlas" />
        </Field>
        <Field>
          <Label htmlFor="capacity">Capacité</Label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            max={20}
            defaultValue={2}
            required
          />
        </Field>
        <Field>
          <Label htmlFor="rate">Tarif par nuit (MAD)</Label>
          <Input id="rate" name="rate" inputMode="decimal" required placeholder="850" />
        </Field>
        <Button type="submit" disabled={mutation.isPending}>
          Ajouter
        </Button>
        {invalidRate ? (
          <Alert className="sm:col-span-4">
            Le tarif doit être un montant, par exemple 850 ou 850,50.
          </Alert>
        ) : null}
        {mutation.isError ? (
          <Alert className="sm:col-span-4">
            {describeError(mutation.error, { 409: 'Une chambre porte déjà ce nom.' })}
          </Alert>
        ) : null}
      </form>
    </Card>
  );
}
