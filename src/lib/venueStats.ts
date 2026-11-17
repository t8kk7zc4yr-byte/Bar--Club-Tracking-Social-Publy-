import type { Visit } from './types';

export interface VenueStats<V extends { id: string }> {
  venue: V;
  /** neueste zuerst */
  visits: Visit[];
  count: number;
  lastVisit?: string;
  firstVisit?: string;
  avgVisitRating: number | null;
  totalSpend: number;
}

/** Besuche je Location zusammenfassen */
export function venueStats<V extends { id: string }>(venues: V[], visits: Visit[]): Map<string, VenueStats<V>> {
  const map = new Map<string, VenueStats<V>>();
  for (const v of venues) map.set(v.id, { venue: v, visits: [], count: 0, avgVisitRating: null, totalSpend: 0 });
  for (const vi of visits) map.get(vi.venueId)?.visits.push(vi);
  for (const s of map.values()) {
    s.visits.sort((a, b) => b.visitedAt.localeCompare(a.visitedAt));
    s.count = s.visits.length;
    s.lastVisit = s.visits[0]?.visitedAt;
    s.firstVisit = s.visits[s.visits.length - 1]?.visitedAt;
    const rated = s.visits.filter((v) => typeof v.rating === 'number');
    s.avgVisitRating = rated.length ? rated.reduce((a, v) => a + v.rating!, 0) / rated.length : null;
    s.totalSpend = s.visits.reduce((a, v) => a + (v.spend ?? 0), 0);
  }
  return map;
}
