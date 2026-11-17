import { EVENING_HOURS, type StatVenue } from './stats';
import { categoryInfo } from './tags';
import type { Visit } from './types';
import { MONTHS_SHORT, WEEKDAYS_SHORT, weekdayIndex } from './util';

export type Metric = 'visits' | 'spend' | 'drinks' | 'rating' | 'venues';
export type Dimension = 'month' | 'weekday' | 'hour' | 'category' | 'city' | 'venue' | 'companion';

export const METRICS: { key: Metric; label: string; unit?: string }[] = [
  { key: 'visits', label: 'Besuche' },
  { key: 'venues', label: 'Versch. Locations' },
  { key: 'drinks', label: 'Getränke' },
  { key: 'spend', label: 'Ausgaben', unit: '€' },
  { key: 'rating', label: 'Ø Bewertung' }
];

export const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: 'month', label: 'Monat' },
  { key: 'weekday', label: 'Wochentag' },
  { key: 'hour', label: 'Uhrzeit' },
  { key: 'category', label: 'Art der Location' },
  { key: 'city', label: 'Stadt' },
  { key: 'venue', label: 'Location' },
  { key: 'companion', label: 'Begleitung' }
];

export const isLongLabelDimension = (d: Dimension) => d === 'category' || d === 'city' || d === 'venue' || d === 'companion';

/** Kennzahl mal Gruppierung. Zeitliche Gruppierungen in fester Reihenfolge, sonst die zehn größten Werte. */
export function buildChart(visits: Visit[], venues: StatVenue[], metric: Metric, dim: Dimension): { label: string; value: number }[] {
  const byId = new Map(venues.map((v) => [v.id, v]));
  const groups = new Map<string, Visit[]>();
  const keysOf = (v: Visit): string[] => {
    const d = new Date(v.visitedAt);
    const venue = byId.get(v.venueId);
    switch (dim) {
      case 'month': return [MONTHS_SHORT[d.getMonth()]];
      case 'weekday': return [WEEKDAYS_SHORT[weekdayIndex(d)]];
      case 'hour': return [EVENING_HOURS.includes(d.getHours()) ? `${d.getHours()} Uhr` : 'Tagsüber'];
      case 'category': {
        if (!venue) return [];
        const c = categoryInfo(venue.category);
        return [`${c.emoji} ${c.label}`];
      }
      case 'city': return venue ? [venue.city || 'Ohne Stadt'] : [];
      case 'venue': return venue ? [venue.name] : [];
      case 'companion': return v.companionsText.length ? v.companionsText : ['Allein / ohne Angabe'];
    }
  };
  for (const v of visits) for (const k of keysOf(v)) groups.set(k, [...(groups.get(k) ?? []), v]);

  const value = (vs: Visit[]): number => {
    switch (metric) {
      case 'visits': return vs.length;
      case 'venues': return new Set(vs.map((v) => v.venueId)).size;
      case 'drinks': return vs.reduce((a, v) => a + v.drinks.reduce((b, d) => b + d.count, 0), 0);
      case 'spend': return Math.round(vs.reduce((a, v) => a + (v.spend ?? 0), 0));
      case 'rating': {
        const r = vs.filter((v) => typeof v.rating === 'number');
        return r.length ? Math.round((r.reduce((a, v) => a + v.rating!, 0) / r.length) * 10) / 10 : 0;
      }
    }
  };

  let order: string[] | null = null;
  if (dim === 'month') order = MONTHS_SHORT;
  if (dim === 'weekday') order = WEEKDAYS_SHORT;
  if (dim === 'hour') order = [...EVENING_HOURS.map((h) => `${h} Uhr`), 'Tagsüber'];

  if (order) {
    return order
      .map((label) => ({ label, value: groups.has(label) ? value(groups.get(label)!) : 0 }))
      .filter((r) => r.label !== 'Tagsüber' || r.value > 0);
  }
  return [...groups.entries()]
    .map(([label, vs]) => ({ label, value: value(vs) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}
