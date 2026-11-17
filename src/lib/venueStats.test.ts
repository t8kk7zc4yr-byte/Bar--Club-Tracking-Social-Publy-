import { describe, expect, it } from 'vitest';
import type { Visit } from './types';
import { venueStats } from './venueStats';

const visit = (id: string, venueId: string, visitedAt: string, rating: number | null, spend: number | null): Visit => ({
  id, userId: 'u', venueId, visitedAt, rating, spend, drinks: [], companionsText: [], updatedAt: visitedAt
});

describe('Statistik je Location', () => {
  const stats = venueStats(
    [{ id: 'a' }, { id: 'b' }],
    [visit('1', 'a', '2026-01-10T20:00:00Z', 8, 10), visit('2', 'a', '2026-03-01T21:00:00Z', 6, 15.5), visit('3', 'a', '2026-02-01T21:00:00Z', null, null), visit('4', 'x', '2026-02-01T21:00:00Z', 9, 5)]
  );
  it('zählt Besuche und ordnet sie zeitlich', () => {
    const a = stats.get('a')!;
    expect(a.count).toBe(3);
    expect(a.lastVisit).toBe('2026-03-01T21:00:00Z');
    expect(a.firstVisit).toBe('2026-01-10T20:00:00Z');
  });
  it('mittelt nur bewertete Besuche und summiert Ausgaben', () => {
    const a = stats.get('a')!;
    expect(a.avgVisitRating).toBe(7);
    expect(a.totalSpend).toBe(25.5);
  });
  it('kommt mit Locations ohne Besuch zurecht', () => {
    const b = stats.get('b')!;
    expect(b.count).toBe(0);
    expect(b.avgVisitRating).toBeNull();
    expect(b.lastVisit).toBeUndefined();
  });
});
