const LOCALE = 'fr-FR';

export function formatMoney(cents: number, currency = 'MAD'): string {
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(cents / 100);
}

/** Parses an amount typed by a user ("850", "850,50", "1 200.5") into cents. */
export function parseMoneyInput(value: string): number | null {
  // \s also matches the no-break spaces produced by copy-pasting formatted amounts.
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  return Math.round(Number(normalized) * 100);
}

const dayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: 'UTC' });
const shortDateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

export function formatWeekday(iso: string): string {
  return dayFormat.format(new Date(`${iso}T00:00:00Z`));
}

export function formatShortDate(iso: string): string {
  return shortDateFormat.format(new Date(`${iso}T00:00:00Z`));
}

export const ROLE_LABELS = {
  OWNER: 'Propriétaire',
  RECEPTION: 'Réception',
  HOUSEKEEPING: 'Ménage',
} as const;

export const STATUS_LABELS = {
  CONFIRMED: 'Confirmée',
  CHECKED_IN: 'Arrivée',
  CHECKED_OUT: 'Partie',
  CANCELLED: 'Annulée',
} as const;
