import { describe, expect, it } from 'vitest';
import { groupByNight, maxStationsPerNight, nightKey, tourName } from './tours';
import type { Visit } from './types';

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString();
const visit = (id: string, venueId: string, visitedAt: string): Visit => ({
  id, userId: 'u', venueId, visitedAt, drinks: [], companionsText: [], updatedAt: visitedAt
});

describe('Kneipentouren', () => {
  it('zählt Besuche bis 6 Uhr morgens zum Vorabend', () => {
    expect(nightKey(at(14, 22))).toBe('2026-11-14');
    expect(nightKey(at(15, 3))).toBe('2026-11-14');
    expect(nightKey(at(15, 6, 1))).toBe('2026-11-15');
  });
  it('gruppiert einen Abend und sortiert zeitlich', () => {
    const g = groupByNight([visit('2', 'b', at(15, 1)), visit('1', 'a', at(14, 21)), visit('3', 'c', at(15, 20))]);
    expect(g.get('2026-11-14')!.map((v) => v.id)).toEqual(['1', '2']);
    expect(g.get('2026-11-15')!.map((v) => v.id)).toEqual(['3']);
  });
  it('zählt verschiedene Stationen eines Abends', () => {
    expect(maxStationsPerNight([visit('1', 'a', at(14, 20)), visit('2', 'b', at(14, 22)), visit('3', 'a', at(15, 1)), visit('4', 'c', at(20, 21))])).toBe(2);
  });
  it('benennt die Tour nach dem Abend', () => {
    expect(tourName('2026-11-14')).toBe('Tour am Sa, 14.11.');
  });
});
