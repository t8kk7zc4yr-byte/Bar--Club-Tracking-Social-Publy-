import type { Visit } from './types';
import { WEEKDAYS_SHORT, weekdayIndex } from './util';

/** Ein Abend endet um 6 Uhr morgens: Besuche bis dahin zählen zum Vortag */
export const NIGHT_CUTOFF_HOURS = 6;

/** Datum des Ausgehabends als JJJJ-MM-TT (lokale Zeit) */
export function nightKey(iso: string): string {
  const d = new Date(new Date(iso).getTime() - NIGHT_CUTOFF_HOURS * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function tourName(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `Tour am ${WEEKDAYS_SHORT[weekdayIndex(date)]}, ${d}.${m}.`;
}

/** Eigene Besuche nach Abend gruppiert, jeweils zeitlich sortiert */
export function groupByNight(visits: Visit[]): Map<string, Visit[]> {
  const out = new Map<string, Visit[]>();
  for (const v of visits) {
    const k = nightKey(v.visitedAt);
    out.set(k, [...(out.get(k) ?? []), v]);
  }
  for (const list of out.values()) list.sort((a, b) => a.visitedAt.localeCompare(b.visitedAt));
  return out;
}

/** Größte Zahl verschiedener Locations an einem Abend */
export function maxStationsPerNight(visits: Visit[]): number {
  let best = 0;
  for (const list of groupByNight(visits).values()) best = Math.max(best, new Set(list.map((v) => v.venueId)).size);
  return best;
}
