import { describe, expect, it } from 'vitest';
import { milestones } from './achievements';
import { buildChart } from './chartBuilder';
import { computeDashboard, currentStreak, longestStreak, weekIndex, type StatVenue } from './stats';
import type { Visit } from './types';

const venue = (id: string, category: StatVenue['category'], city: string, rating: number | null, extra: Partial<StatVenue> = {}): StatVenue => ({
  id, name: id, category, city, rating, tags: [], favorite: false, wishlist: false, ...extra
});
const visit = (id: string, venueId: string, when: Date, extra: Partial<Visit> = {}): Visit => ({
  id, userId: 'u', venueId, visitedAt: when.toISOString(), rating: null, spend: null, drinks: [], companionsText: [], updatedAt: '', ...extra
});
// Montag, 16.11.2026, 12 Uhr
const now = new Date(2026, 10, 16, 12);
const daysAgo = (n: number, hour = 21) => new Date(2026, 10, 16 - n, hour);

describe('Kalenderwochen und Serien', () => {
  it('zählt Montag bis Sonntag als eine Woche', () => {
    expect(weekIndex(new Date(2026, 10, 16))).toBe(weekIndex(new Date(2026, 10, 22, 23)));
    expect(weekIndex(new Date(2026, 10, 15))).toBe(weekIndex(new Date(2026, 10, 16)) - 1);
  });
  it('rechnet die aktuelle Serie, auch wenn diese Woche noch kein Besuch war', () => {
    const vs = [visit('1', 'a', daysAgo(2)), visit('2', 'a', daysAgo(9)), visit('3', 'a', daysAgo(16)), visit('4', 'a', daysAgo(40))];
    expect(currentStreak(vs, now)).toBe(3);
    expect(currentStreak([visit('1', 'a', daysAgo(20))], now)).toBe(0);
  });
  it('findet die längste Serie', () => {
    const vs = [visit('1', 'a', daysAgo(2)), visit('2', 'a', daysAgo(9)), visit('3', 'a', daysAgo(60)), visit('4', 'a', daysAgo(67)), visit('5', 'a', daysAgo(74))];
    expect(longestStreak(vs)).toBe(3);
    expect(longestStreak([])).toBe(0);
  });
});

describe('Dashboard', () => {
  const venues = [venue('a', 'bar', 'Köln', 8, { favorite: true }), venue('b', 'club', 'Berlin', 10), venue('w', 'bar', 'Köln', null, { wishlist: true })];
  const visits = [
    visit('1', 'a', daysAgo(1), { spend: 20, drinks: [{ name: 'Kölsch', count: 3 }] }),
    visit('2', 'a', daysAgo(8), { spend: 10.5 }),
    visit('3', 'b', daysAgo(30), { spend: 40 }),
    visit('4', 'a', new Date(2025, 5, 1, 22)),
    visit('5', 'a', new Date(2025, 11, 24, 22))
  ];
  const d = computeDashboard(venues, visits, 2026, now);
  it('vergleicht Monat und Jahr', () => {
    expect(d.monthVisits).toBe(2);
    expect(d.prevMonthVisits).toBe(1);
    expect(d.yearVisits).toBe(3);
    // nur der Juni-Besuch 2025 liegt vor dem 16.11.
    expect(d.prevYearVisitsToDate).toBe(1);
    expect(d.spendMonth).toBe(30.5);
  });
  it('zählt Städte, Locations und Bewertungen ohne Wunschliste', () => {
    expect(d.citiesYear).toBe(2);
    expect(d.totalVenues).toBe(2);
    expect(d.newVenuesYear).toBe(1);
    expect(d.avgRating).toBe(9);
    expect(d.ratingDist).toHaveLength(10);
    expect(d.ratingDist[9]).toMatchObject({ rating: 10, count: 1 });
    expect(d.favorites.map((s) => s.venue.id)).toEqual(['a']);
  });
  it('liefert zwölf Wochen, die aktuelle zuletzt', () => {
    expect(d.perWeek).toHaveLength(12);
    expect(d.perWeek[11]).toEqual({ label: '16.11.', value: 0 });
    expect(d.perWeek[10].value).toBe(1);
  });
});

describe('Diagramm-Baukasten', () => {
  const venues = [venue('a', 'bar', 'Köln', 8), venue('b', 'club', 'Berlin', 10)];
  const visits = [
    visit('1', 'a', daysAgo(1), { spend: 20, rating: 8, companionsText: ['Leon', 'Matteo'] }),
    visit('2', 'b', daysAgo(2), { spend: 40, rating: 6, companionsText: ['Leon'] }),
    visit('3', 'a', daysAgo(3), { spend: 5 })
  ];
  it('gruppiert Ausgaben nach Stadt', () => {
    expect(buildChart(visits, venues, 'spend', 'city')).toEqual([{ label: 'Berlin', value: 40 }, { label: 'Köln', value: 25 }]);
  });
  it('zählt Besuche je Begleitung mehrfach', () => {
    const r = buildChart(visits, venues, 'visits', 'companion');
    expect(r[0]).toEqual({ label: 'Leon', value: 2 });
    expect(r).toContainEqual({ label: 'Allein / ohne Angabe', value: 1 });
  });
  it('hält Wochentage in fester Reihenfolge', () => {
    expect(buildChart(visits, venues, 'visits', 'weekday').map((x) => x.label)).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
  });
});

describe('Meilensteine', () => {
  it('ordnet Stufen zu und nennt das nächste Ziel', () => {
    const venues = Array.from({ length: 6 }, (_, i) => venue(`v${i}`, i < 5 ? 'bar' : 'club', i % 2 ? 'Köln' : 'Bonn', i === 0 ? 10 : 7));
    const visits = venues.map((v, i) => visit(`x${i}`, v.id, daysAgo(i)));
    const ms = milestones(venues, visits, 0);
    const bars = ms.find((m) => m.id === 'bars')!;
    expect(bars).toMatchObject({ value: 5, level: 2, goal: 10, done: false });
    expect(ms.find((m) => m.id === 'clubs')).toMatchObject({ value: 1, level: 1, goal: 3 });
    expect(ms.find((m) => m.id === 'gold')).toMatchObject({ level: 1 });
    expect(ms.find((m) => m.id === 'photo')).toMatchObject({ level: 0, goal: 1 });
  });
  it('enthält keinen Meilenstein für Getränke', () => {
    expect(milestones([], [], 0).some((m) => /getränk|drink|bier/i.test(m.desc + m.id))).toBe(false);
  });
});
