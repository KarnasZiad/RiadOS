import { describe, expect, it } from 'vitest';
import { isNightFree, placeStay } from './calendar';

const windowStart = '2026-10-20';

describe('placeStay', () => {
  it('places a stay inside the window', () => {
    expect(placeStay({ checkIn: '2026-10-22', checkOut: '2026-10-25' }, windowStart, 14)).toEqual({
      offset: 2,
      span: 3,
      startsBefore: false,
      endsAfter: false,
    });
  });

  it('clips a stay that started before the window', () => {
    expect(placeStay({ checkIn: '2026-10-18', checkOut: '2026-10-22' }, windowStart, 14)).toEqual({
      offset: 0,
      span: 2,
      startsBefore: true,
      endsAfter: false,
    });
  });

  it('clips a stay that ends after the window', () => {
    expect(placeStay({ checkIn: '2026-11-01', checkOut: '2026-11-05' }, windowStart, 14)).toEqual({
      offset: 12,
      span: 2,
      startsBefore: false,
      endsAfter: true,
    });
  });

  it.each([
    { checkIn: '2026-10-10', checkOut: '2026-10-20' },
    { checkIn: '2026-11-03', checkOut: '2026-11-05' },
  ])('ignores a stay outside the window (%o)', (stay) => {
    expect(placeStay(stay, windowStart, 14)).toBeNull();
  });
});

describe('isNightFree', () => {
  const stays = [{ checkIn: '2026-10-20', checkOut: '2026-10-22' }];

  it('treats the departure day as free', () => {
    expect(isNightFree(stays, '2026-10-21')).toBe(false);
    expect(isNightFree(stays, '2026-10-22')).toBe(true);
    expect(isNightFree(stays, '2026-10-19')).toBe(true);
  });
});
