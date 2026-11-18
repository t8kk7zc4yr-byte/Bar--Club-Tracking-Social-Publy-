import { longestStreak, type StatVenue } from './stats';
import { SPORT_TAGS, type CategoryId } from './tags';
import { maxStationsPerNight } from './tours';
import type { Visit } from './types';

/**
 * Meilensteine mit Stufen. Bewusst ohne Getränkemengen: gezählt werden Orte, Städte und Abende.
 */
export interface Milestone {
  id: string;
  emoji: string;
  title: string;
  /** z. B. „in 10 Bars gewesen“ für die nächste oder letzte Stufe */
  desc: string;
  value: number;
  /** erreichte Stufe (0 = noch keine) */
  level: number;
  levels: number;
  /** nächstes Ziel; bei höchster Stufe das letzte */
  goal: number;
  done: boolean;
}

const BAR_LIKE: CategoryId[] = ['bar', 'kneipe', 'irish_pub', 'cocktailbar', 'weinbar', 'biergarten', 'brauhaus', 'rooftop', 'sportsbar', 'shisha_bar'];

function tiered(id: string, emoji: string, title: string, value: number, tiers: number[], desc: (goal: number) => string): Milestone {
  const level = tiers.filter((t) => value >= t).length;
  const done = level === tiers.length;
  const goal = tiers[Math.min(level, tiers.length - 1)];
  return { id, emoji, title, desc: desc(goal), value, level, levels: tiers.length, goal, done };
}

export function milestones(venues: StatVenue[], visits: Visit[], photoCount: number): Milestone[] {
  const visitedIds = new Set(visits.map((v) => v.venueId));
  const visited = venues.filter((v) => visitedIds.has(v.id));
  const bars = visited.filter((v) => BAR_LIKE.includes(v.category)).length;
  const clubs = visited.filter((v) => v.category === 'club').length;
  const cities = new Set(visited.map((v) => v.city).filter(Boolean)).size;
  const cats = new Set(visited.map((v) => v.category)).size;
  const counts = new Map<string, number>();
  visits.forEach((v) => counts.set(v.venueId, (counts.get(v.venueId) ?? 0) + 1));
  const maxSame = Math.max(0, ...counts.values());
  const late = visits.filter((v) => {
    const h = new Date(v.visitedAt).getHours();
    return h >= 1 && h < 6;
  }).length;
  const sport = visited.filter((v) => v.tags.some((t) => SPORT_TAGS.includes(t))).length;
  const tens = venues.filter((v) => v.rating === 10).length;

  return [
    tiered('bars', '🍺', 'Bargänger', bars, [1, 5, 10, 25, 50, 100], (g) => `In ${g} ${g === 1 ? 'Bar oder Kneipe' : 'Bars und Kneipen'} gewesen`),
    tiered('clubs', '🪩', 'Clubgänger', clubs, [1, 3, 5, 10, 25, 50], (g) => `In ${g} ${g === 1 ? 'Club' : 'Clubs'} gewesen`),
    tiered('visits', '🥂', 'Unterwegs', visits.length, [1, 10, 25, 50, 100, 250], (g) => `${g} ${g === 1 ? 'Besuch' : 'Besuche'} eingetragen`),
    tiered('cities', '🗺️', 'Städtetrip', cities, [2, 3, 5, 10, 20], (g) => `In ${g} Städten unterwegs`),
    tiered('streak', '🔥', 'Dranbleiber', longestStreak(visits), [2, 4, 8, 12, 26], (g) => `${g} Wochen in Folge unterwegs`),
    tiered('tour', '🚶', 'Kneipentour', maxStationsPerNight(visits), [2, 3, 5, 8], (g) => `${g} Locations an einem Abend`),
    tiered('variety', '🎨', 'Sammler', cats, [3, 5, 8, 12], (g) => `${g} verschiedene Arten von Locations`),
    tiered('regular', '🪑', 'Stammgast', maxSame, [5, 10, 25], (g) => `${g}× in derselben Location`),
    tiered('sport', '⚽', 'Public Viewer', sport, [1, 3, 10], (g) => `${g} ${g === 1 ? 'Location' : 'Locations'} mit Live-Sport besucht`),
    tiered('owl', '🦉', 'Nachteule', late, [3, 10, 25], (g) => `${g} Check-ins zwischen 1 und 6 Uhr`),
    tiered('photo', '📸', 'Paparazzo', photoCount, [1, 10, 50], (g) => `${g} ${g === 1 ? 'Foto' : 'Fotos'} gespeichert`),
    tiered('gold', '👑', 'Gefunden!', tens, [1, 3, 5], (g) => `${g} ${g === 1 ? 'Location' : 'Locations'} mit 10 bewertet`)
  ];
}
