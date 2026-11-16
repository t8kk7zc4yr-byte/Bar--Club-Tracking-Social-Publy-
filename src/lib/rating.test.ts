import { describe, expect, it } from 'vitest';
import { fmtRating, isValidRating, RATING_VALUES, tierFor } from './rating';

describe('Bewertung 1–10', () => {
  it('kennt genau die Werte 1 bis 10', () => {
    expect(RATING_VALUES).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(11)).toBe(false);
    expect(isValidRating(7.5)).toBe(false);
    expect(isValidRating(10)).toBe(true);
  });
  it('ordnet Farbstufen zu', () => {
    expect([1, 3].map((r) => tierFor(r).key)).toEqual(['bad', 'bad']);
    expect([4, 6].map((r) => tierFor(r).key)).toEqual(['ok', 'ok']);
    expect([7, 9].map((r) => tierFor(r).key)).toEqual(['good', 'good']);
    expect(tierFor(10).key).toBe('top');
    expect(tierFor(null).key).toBe('none');
    expect(tierFor(7.2).key).toBe('good');
  });
  it('formatiert deutsch', () => {
    expect(fmtRating(7.24)).toBe('7,2');
    expect(fmtRating(8)).toBe('8');
    expect(fmtRating(null)).toBe('–');
  });
});
