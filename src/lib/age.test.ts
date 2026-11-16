import { describe, expect, it } from 'vitest';
import { ageOn, isAdult } from './age';

const now = new Date(2026, 10, 16); // 16.11.2026

describe('Altersprüfung', () => {
  it('rechnet volle Jahre', () => {
    expect(ageOn('2008-11-16', now)).toBe(18);
    expect(ageOn('2008-11-17', now)).toBe(17);
    expect(ageOn('2000-01-01', now)).toBe(26);
  });
  it('lässt genau am 18. Geburtstag zu, einen Tag vorher nicht', () => {
    expect(isAdult('2008-11-16', 18, now)).toBe(true);
    expect(isAdult('2008-11-17', 18, now)).toBe(false);
  });
  it('lehnt ungültige und zukünftige Daten ab', () => {
    expect(isAdult('', 18, now)).toBe(false);
    expect(isAdult('2001-02-30', 18, now)).toBe(false);
    expect(isAdult('2030-01-01', 18, now)).toBe(false);
    expect(isAdult('1850-01-01', 18, now)).toBe(false);
  });
});
