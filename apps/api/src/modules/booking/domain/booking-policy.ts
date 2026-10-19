import type { DateRange } from './date-range';

export const MAX_STAY_NIGHTS = 60;
export const MAX_CALENDAR_DAYS = 62;

export class BookingRuleViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingRuleViolation';
  }
}

export interface BookableRoom {
  capacity: number;
  isActive: boolean;
}

export interface Party {
  adults: number;
  children: number;
}

/** Business rules a stay must satisfy before availability is even checked. */
export function assertBookable(stay: DateRange, room: BookableRoom, party: Party): void {
  if (stay.nights > MAX_STAY_NIGHTS) {
    throw new BookingRuleViolation(`A stay cannot exceed ${MAX_STAY_NIGHTS} nights`);
  }
  if (!room.isActive) {
    throw new BookingRuleViolation('This room is out of service');
  }
  const guests = party.adults + party.children;
  if (guests > room.capacity) {
    throw new BookingRuleViolation(
      `This room sleeps ${room.capacity} guests, the reservation has ${guests}`,
    );
  }
}
