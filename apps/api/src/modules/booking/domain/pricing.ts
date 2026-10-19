import type { DateRange } from './date-range';

export interface StayQuote {
  nights: number;
  nightlyRateCents: number;
  totalCents: number;
}

/**
 * Prices a stay on the server: the client never sends an amount.
 * Amounts are integers in minor units (centimes) to avoid floating-point rounding errors.
 */
export function quoteStay(nightlyRateCents: number, stay: DateRange): StayQuote {
  if (!Number.isSafeInteger(nightlyRateCents) || nightlyRateCents < 0) {
    throw new RangeError('The nightly rate must be a non-negative integer amount in cents');
  }
  return { nights: stay.nights, nightlyRateCents, totalCents: nightlyRateCents * stay.nights };
}
