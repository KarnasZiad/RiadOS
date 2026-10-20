/** Calendar dates are ISO strings (YYYY-MM-DD) handled in UTC: a night does not depend on time zones. */

const DAY_MS = 86_400_000;

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function addDays(iso: string, days: number): string {
  return toIsoDate(new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function dateRange(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** First day of the month `months` away from the month of `iso`. */
export function addMonths(iso: string, months: number): string {
  const date = new Date(`${startOfMonth(iso)}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return toIsoDate(date);
}

export function isWeekend(iso: string): boolean {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}
