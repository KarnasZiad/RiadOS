import { describe, expect, it } from 'vitest';
import { assertBookable, BookingRuleViolation, MAX_STAY_NIGHTS } from './booking-policy';
import { DateRange } from './date-range';

const room = { capacity: 3, isActive: true };
const stay = DateRange.parse('2026-10-20', '2026-10-23');

describe('assertBookable', () => {
  it('accepts a stay that fits the room', () => {
    expect(() => {
      assertBookable(stay, room, { adults: 2, children: 1 });
    }).not.toThrow();
  });

  it('refuses more guests than the room sleeps', () => {
    expect(() => {
      assertBookable(stay, room, { adults: 2, children: 2 });
    }).toThrow('This room sleeps 3 guests, the reservation has 4');
  });

  it('refuses a room that is out of service', () => {
    expect(() => {
      assertBookable(stay, { ...room, isActive: false }, { adults: 1, children: 0 });
    }).toThrow(BookingRuleViolation);
  });

  it(`refuses stays longer than ${MAX_STAY_NIGHTS} nights`, () => {
    const longStay = DateRange.parse('2026-10-01', '2026-12-01');

    expect(() => {
      assertBookable(longStay, room, { adults: 1, children: 0 });
    }).toThrow(`A stay cannot exceed ${MAX_STAY_NIGHTS} nights`);
  });
});
