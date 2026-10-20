import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  dateRange,
  daysBetween,
  isWeekend,
  startOfMonth,
  todayIso,
  toIsoDate,
} from './dates';

describe('dates', () => {
  it('uses the local calendar day as today', () => {
    expect(todayIso(new Date(2026, 9, 20, 23, 30))).toBe('2026-10-20');
  });

  it('adds days across months and years', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts the days between two dates', () => {
    expect(daysBetween('2026-10-20', '2026-10-23')).toBe(3);
    expect(daysBetween('2026-10-23', '2026-10-20')).toBe(-3);
  });

  it('builds a range of consecutive days', () => {
    expect(dateRange('2026-10-30', 4)).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('moves between months', () => {
    expect(addMonths('2026-10-20', 1)).toBe('2026-11-01');
    expect(addMonths('2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01');
  });

  it('finds the first day of the month and weekends', () => {
    expect(startOfMonth('2026-10-20')).toBe('2026-10-01');
    expect(isWeekend('2026-10-24')).toBe(true);
    expect(isWeekend('2026-10-26')).toBe(false);
    expect(toIsoDate(new Date('2026-10-20T15:00:00Z'))).toBe('2026-10-20');
  });
});
