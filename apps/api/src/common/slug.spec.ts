import { describe, expect, it } from 'vitest';
import { slugify } from './slug';

describe('slugify', () => {
  it.each([
    ['Riad Yasmine', 'riad-yasmine'],
    ['Dar Él Bacha & Spa', 'dar-el-bacha-spa'],
    ['  --Maison  d’hôtes Atlas--  ', 'maison-d-hotes-atlas'],
    ['رياض الياسمين', ''],
  ])('turns "%s" into "%s"', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('limits the length without leaving a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(47)} bcd`);

    expect(slug).toBe('a'.repeat(47));
  });
});
