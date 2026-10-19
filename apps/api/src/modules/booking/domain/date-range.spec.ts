import { describe, expect, it } from 'vitest';
import { DateRange, formatIsoDate, InvalidDateRangeError, parseIsoDate } from './date-range';

describe('parseIsoDate', () => {
  it('parses a calendar date as UTC midnight', () => {
    expect(parseIsoDate('2026-10-20').toISOString()).toBe('2026-10-20T00:00:00.000Z');
  });

  it.each(['2026-02-30', '2026-13-01', '20-10-2026', '2026-10-20T10:00', ''])(
    'rejects "%s"',
    (value) => {
      expect(() => parseIsoDate(value)).toThrow(InvalidDateRangeError);
    },
  );

  it('formats back to the same calendar date', () => {
    expect(formatIsoDate(parseIsoDate('2028-02-29'))).toBe('2028-02-29');
  });
});

describe('DateRange', () => {
  it('counts nights between arrival and departure', () => {
    expect(DateRange.parse('2026-10-20', '2026-10-23').nights).toBe(3);
  });

  it('counts nights correctly across the end of daylight saving time', () => {
    expect(DateRange.parse('2026-10-24', '2026-10-27').nights).toBe(3);
  });

  it('refuses an empty or reversed range', () => {
    expect(() => DateRange.parse('2026-10-20', '2026-10-20')).toThrow(InvalidDateRangeError);
    expect(() => DateRange.parse('2026-10-21', '2026-10-20')).toThrow(InvalidDateRangeError);
  });

  it.each([
    ['2026-10-10', '2026-10-12', '2026-10-11', '2026-10-13', true],
    ['2026-10-10', '2026-10-15', '2026-10-11', '2026-10-12', true],
    ['2026-10-10', '2026-10-12', '2026-10-12', '2026-10-14', false],
    ['2026-10-12', '2026-10-14', '2026-10-10', '2026-10-12', false],
    ['2026-10-10', '2026-10-11', '2026-10-20', '2026-10-21', false],
  ])('%s → %s overlaps %s → %s: %s', (aStart, aEnd, bStart, bEnd, expected) => {
    const a = DateRange.parse(aStart, aEnd);
    const b = DateRange.parse(bStart, bEnd);

    expect(a.overlaps(b)).toBe(expected);
    expect(b.overlaps(a)).toBe(expected);
  });

  it('serializes to calendar dates', () => {
    expect(JSON.stringify(DateRange.parse('2026-10-20', '2026-10-22'))).toBe(
      '{"start":"2026-10-20","end":"2026-10-22"}',
    );
  });
});
