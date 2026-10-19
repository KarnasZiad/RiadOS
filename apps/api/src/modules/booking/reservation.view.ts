import type { BookingSource, Prisma, ReservationStatus } from '@prisma/client';
import { DateRange, formatIsoDate } from './domain/date-range';

export const RESERVATION_VIEW_INCLUDE = {
  room: { select: { id: true, name: true } },
  guest: { select: { id: true, fullName: true } },
} satisfies Prisma.ReservationInclude;

export type ReservationRecord = Prisma.ReservationGetPayload<{
  include: typeof RESERVATION_VIEW_INCLUDE;
}>;

/** Public representation of a reservation: no tenant id, dates as calendar days. */
export interface ReservationView {
  id: string;
  room: { id: string; name: string };
  guest: { id: string; fullName: string };
  checkIn: string;
  checkOut: string;
  nights: number;
  status: ReservationStatus;
  source: BookingSource;
  adults: number;
  children: number;
  totalCents: number;
  currency: string;
  notes: string | null;
  createdAt: string;
}

export function toReservationView(record: ReservationRecord): ReservationView {
  return {
    id: record.id,
    room: record.room,
    guest: record.guest,
    checkIn: formatIsoDate(record.checkIn),
    checkOut: formatIsoDate(record.checkOut),
    nights: DateRange.fromDates(record.checkIn, record.checkOut).nights,
    status: record.status,
    source: record.source,
    adults: record.adults,
    children: record.children,
    totalCents: record.totalCents,
    currency: record.currency,
    notes: record.notes,
    createdAt: record.createdAt.toISOString(),
  };
}
