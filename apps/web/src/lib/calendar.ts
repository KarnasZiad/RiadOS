import { daysBetween } from './dates';

export interface StayLike {
  checkIn: string;
  checkOut: string;
}

export interface Placement {
  /** Index of the first visible night in the window. */
  offset: number;
  /** Number of visible nights. */
  span: number;
  startsBefore: boolean;
  endsAfter: boolean;
}

/**
 * Positions a stay on a calendar window of `dayCount` nights starting at `windowStart`.
 * Returns null when the stay is entirely outside the window.
 */
export function placeStay(stay: StayLike, windowStart: string, dayCount: number): Placement | null {
  const start = daysBetween(windowStart, stay.checkIn);
  const end = daysBetween(windowStart, stay.checkOut);
  const visibleStart = Math.max(0, start);
  const visibleEnd = Math.min(dayCount, end);
  if (visibleEnd <= visibleStart) {
    return null;
  }
  return {
    offset: visibleStart,
    span: visibleEnd - visibleStart,
    startsBefore: start < 0,
    endsAfter: end > dayCount,
  };
}

/** Whether the night `date` is free in a room, given its active stays. */
export function isNightFree(stays: readonly StayLike[], date: string): boolean {
  return stays.every((stay) => date < stay.checkIn || date >= stay.checkOut);
}
