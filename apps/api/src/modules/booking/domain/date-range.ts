const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export class InvalidDateRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDateRangeError';
  }
}

/** Parses a calendar date (YYYY-MM-DD) as UTC midnight. Rejects impossible dates such as 2026-02-30. */
export function parseIsoDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!ISO_DATE.test(value) || Number.isNaN(date.getTime()) || formatIsoDate(date) !== value) {
    throw new InvalidDateRangeError(`Invalid date "${value}", expected YYYY-MM-DD`);
  }
  return date;
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Half-open range of nights [start, end): `end` is the departure day, when the room is free again.
 * A stay ending on the 12th and another starting on the 12th do not overlap.
 */
export class DateRange {
  private constructor(
    readonly start: Date,
    readonly end: Date,
  ) {}

  static parse(start: string, end: string): DateRange {
    return DateRange.fromDates(parseIsoDate(start), parseIsoDate(end));
  }

  static fromDates(start: Date, end: Date): DateRange {
    if (end.getTime() <= start.getTime()) {
      throw new InvalidDateRangeError('The end date must be after the start date');
    }
    return new DateRange(start, end);
  }

  get nights(): number {
    return Math.round((this.end.getTime() - this.start.getTime()) / DAY_MS);
  }

  overlaps(other: DateRange): boolean {
    return this.start < other.end && other.start < this.end;
  }

  toJSON(): { start: string; end: string } {
    return { start: formatIsoDate(this.start), end: formatIsoDate(this.end) };
  }
}
