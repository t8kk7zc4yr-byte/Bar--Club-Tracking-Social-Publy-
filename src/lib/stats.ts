import type { CategoryId, TagId } from './tags';
import type { Visit } from './types';
import { MONTHS_SHORT, WEEKDAYS_SHORT, weekdayIndex } from './util';
import { venueStats, type VenueStats } from './venueStats';

/** Was die Statistik von einer Location wissen muss */
export interface StatVenue {
  id: string;
  name: string;
  category: CategoryId;
  city: string;
  rating: number | null;
  tags: TagId[];
  favorite: boolean;
  wishlist: boolean;
}

const inMonth = (iso: string, y: number, m: number) => {
  const d = new Date(iso);
  return d.getFullYear() === y && d.getMonth() === m;
};
const inYear = (iso: string, y: number) => new Date(iso).getFullYear() === y;

const WEEK_MS = 7 * 86400000;
/** Fortlaufende Nummer der Kalenderwoche (Montag bis Sonntag) */
export function weekIndex(d: Date): number {
  const monday = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - weekdayIndex(d));
  // 05.01.1970 war ein Montag
  return Math.round((monday - 4 * 86400000) / WEEK_MS);
}

/** Aktuelle Serie: Wochen in Folge mit mindestens einem Besuch, bis einschließlich dieser oder der letzten Woche */
export function currentStreak(visits: Visit[], now = new Date()): number {
  const weeks = new Set(visits.map((v) => weekIndex(new Date(v.visitedAt))));
  let w = weekIndex(now);
  if (!weeks.has(w)) w -= 1;
  let streak = 0;
  while (weeks.has(w)) {
    streak++;
    w--;
  }
  return streak;
}

/** Längste Serie aller Zeiten */
export function longestStreak(visits: Visit[]): number {
  const weeks = [...new Set(visits.map((v) => weekIndex(new Date(v.visitedAt))))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  weeks.forEach((w, i) => {
    run = i > 0 && weeks[i - 1] === w - 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

export interface Dashboard<V extends StatVenue> {
  monthVisits: number;
  prevMonthVisits: number;
  yearVisits: number;
  prevYearVisitsToDate: number;
  newVenuesYear: number;
  citiesYear: number;
  totalVenues: number;
  totalCities: number;
  avgRating: number | null;
  spendMonth: number;
  spendYear: number;
  topDrink?: { name: string; count: number };
  perMonth: { label: string; visits: number; prev: number }[];
  /** die letzten zwölf Kalenderwochen, älteste zuerst */
  perWeek: { label: string; value: number }[];
  perWeekday: { label: string; visits: number }[];
  perHour: { label: string; visits: number }[];
  perCategory: { name: CategoryId; value: number }[];
  perCity: { name: string; visits: number; venues: number }[];
  ratingDist: { label: string; count: number; rating: number }[];
  topWeekday?: string;
  streakWeeks: number;
  favorites: VenueStats<V>[];
  mostVisited: VenueStats<V>[];
  topRated: VenueStats<V>[];
  recent: (Visit & { venue?: V })[];
}

/** Uhrzeiten eines Abends: 18 Uhr bis 5 Uhr morgens */
export const EVENING_HOURS = [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5];

export function computeDashboard<V extends StatVenue>(venues: V[], visits: Visit[], year: number, now = new Date()): Dashboard<V> {
  const vs = venueStats(venues, visits);
  const byId = new Map(venues.map((v) => [v.id, v]));
  const m = now.getMonth();
  const y = now.getFullYear();
  const pm = m === 0 ? 11 : m - 1;
  const py = m === 0 ? y - 1 : y;

  const yearVisits = visits.filter((v) => inYear(v.visitedAt, year));
  const prevYearToDate = visits.filter((v) => {
    const d = new Date(v.visitedAt);
    if (d.getFullYear() !== year - 1) return false;
    if (year !== y) return true;
    const same = new Date(d);
    same.setFullYear(y);
    return same <= now;
  });

  const perMonth = MONTHS_SHORT.map((label, i) => ({
    label,
    visits: yearVisits.filter((v) => new Date(v.visitedAt).getMonth() === i).length,
    prev: visits.filter((v) => inMonth(v.visitedAt, year - 1, i)).length
  }));

  const thisWeek = weekIndex(now);
  const weekCounts = new Map<number, number>();
  visits.forEach((v) => {
    const w = weekIndex(new Date(v.visitedAt));
    weekCounts.set(w, (weekCounts.get(w) ?? 0) + 1);
  });
  const perWeek = Array.from({ length: 12 }, (_, i) => {
    const w = thisWeek - 11 + i;
    const monday = new Date(w * WEEK_MS + 4 * 86400000);
    return { label: `${monday.getUTCDate()}.${monday.getUTCMonth() + 1}.`, value: weekCounts.get(w) ?? 0 };
  });

  const perWeekday = WEEKDAYS_SHORT.map((label) => ({ label, visits: 0 }));
  // Der Ausgehtag ist der Abend: Besuche bis 6 Uhr morgens zählen zum Vortag
  yearVisits.forEach((v) => perWeekday[weekdayIndex(new Date(new Date(v.visitedAt).getTime() - 6 * 3600 * 1000))].visits++);
  const topWd = [...perWeekday].sort((a, b) => b.visits - a.visits)[0];

  const perHour = EVENING_HOURS.map((h) => ({ label: `${h}`, visits: 0 }));
  yearVisits.forEach((v) => {
    const idx = EVENING_HOURS.indexOf(new Date(v.visitedAt).getHours());
    if (idx >= 0) perHour[idx].visits++;
  });

  const catMap = new Map<CategoryId, number>();
  const cityMap = new Map<string, { visits: number; venues: Set<string> }>();
  yearVisits.forEach((v) => {
    const venue = byId.get(v.venueId);
    if (!venue) return;
    catMap.set(venue.category, (catMap.get(venue.category) ?? 0) + 1);
    const c = cityMap.get(venue.city) ?? { visits: 0, venues: new Set<string>() };
    c.visits++;
    c.venues.add(venue.id);
    cityMap.set(venue.city, c);
  });
  const perCategory = [...catMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const perCity = [...cityMap.entries()].map(([name, c]) => ({ name, visits: c.visits, venues: c.venues.size })).sort((a, b) => b.visits - a.visits);

  const rated = venues.filter((v) => v.rating !== null && !v.wishlist);
  const ratingDist = Array.from({ length: 10 }, (_, i) => ({
    label: String(i + 1),
    rating: i + 1,
    count: rated.filter((v) => v.rating === i + 1).length
  }));

  const drinkMap = new Map<string, number>();
  yearVisits.forEach((v) => v.drinks.forEach((d) => drinkMap.set(d.name, (drinkMap.get(d.name) ?? 0) + d.count)));
  const topDrinkEntry = [...drinkMap.entries()].sort((a, b) => b[1] - a[1])[0];

  const all = [...vs.values()].filter((s) => !s.venue.wishlist);
  const visited = all.filter((s) => s.count > 0);

  return {
    monthVisits: visits.filter((v) => inMonth(v.visitedAt, y, m)).length,
    prevMonthVisits: visits.filter((v) => inMonth(v.visitedAt, py, pm)).length,
    yearVisits: yearVisits.length,
    prevYearVisitsToDate: prevYearToDate.length,
    newVenuesYear: all.filter((s) => s.firstVisit && inYear(s.firstVisit, year)).length,
    citiesYear: cityMap.size,
    totalVenues: visited.length,
    totalCities: new Set(visited.map((s) => s.venue.city)).size,
    avgRating: rated.length ? rated.reduce((a, v) => a + v.rating!, 0) / rated.length : null,
    spendMonth: visits.filter((v) => inMonth(v.visitedAt, y, m)).reduce((a, v) => a + (v.spend ?? 0), 0),
    spendYear: yearVisits.reduce((a, v) => a + (v.spend ?? 0), 0),
    topDrink: topDrinkEntry ? { name: topDrinkEntry[0], count: topDrinkEntry[1] } : undefined,
    perMonth,
    perWeek,
    perWeekday,
    perHour,
    perCategory,
    perCity,
    ratingDist,
    topWeekday: topWd && topWd.visits > 0 ? topWd.label : undefined,
    streakWeeks: currentStreak(visits, now),
    favorites: all.filter((s) => s.venue.favorite).sort((a, b) => (b.venue.rating ?? -1) - (a.venue.rating ?? -1)),
    mostVisited: [...visited].sort((a, b) => b.count - a.count).slice(0, 5),
    topRated: all.filter((s) => s.venue.rating !== null).sort((a, b) => b.venue.rating! - a.venue.rating! || b.count - a.count).slice(0, 5),
    recent: [...visits].sort((a, b) => b.visitedAt.localeCompare(a.visitedAt)).slice(0, 5).map((v) => ({ ...v, venue: byId.get(v.venueId) }))
  };
}
