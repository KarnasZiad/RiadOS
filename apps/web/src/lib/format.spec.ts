import { describe, expect, it } from 'vitest';
import { formatMoney, formatShortDate, formatWeekday, parseMoneyInput } from './format';

/** Intl separates groups with no-break spaces, which \s matches: compare on regular spaces. */
const plain = (value: string) => value.replace(/\s/g, ' ');

describe('format', () => {
  it('formats amounts in cents', () => {
    expect(plain(formatMoney(85_000))).toBe('850,00 MAD');
    expect(plain(formatMoney(1_234_567, 'EUR'))).toBe('12 345,67 €');
  });

  it.each([
    ['850', 85_000],
    ['850,5', 85_050],
    ['1 200.25', 120_025],
    ['0', 0],
  ])('parses "%s" as %d cents', (input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '12,345', '1.2.3'])('rejects "%s"', (input) => {
    expect(parseMoneyInput(input)).toBeNull();
  });

  it('formats calendar dates without time zone shifts', () => {
    expect(formatWeekday('2026-10-20')).toBe('mar.');
    expect(formatShortDate('2026-10-20')).toBe('20 oct.');
  });
});
