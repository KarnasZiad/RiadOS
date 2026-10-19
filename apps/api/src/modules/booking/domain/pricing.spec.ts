import { describe, expect, it } from 'vitest';
import { DateRange } from './date-range';
import { quoteStay } from './pricing';

describe('quoteStay', () => {
  it('multiplies the nightly rate by the number of nights', () => {
    const quote = quoteStay(85_000, DateRange.parse('2026-12-28', '2027-01-02'));

    expect(quote).toEqual({ nights: 5, nightlyRateCents: 85_000, totalCents: 425_000 });
  });

  it.each([-1, 12.5, Number.NaN])('rejects the nightly rate %s', (rate) => {
    expect(() => quoteStay(rate, DateRange.parse('2026-10-20', '2026-10-21'))).toThrow(RangeError);
  });
});
