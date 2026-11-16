/** Kategorien und Merkmale. Die Schlüssel (id) werden in der Datenbank gespeichert und dürfen nicht umbenannt werden. */

export const CATEGORIES = [
  { id: 'bar', label: 'Bar', emoji: '🍸' },
  { id: 'club', label: 'Club', emoji: '🪩' },
  { id: 'kneipe', label: 'Kneipe', emoji: '🍺' },
  { id: 'irish_pub', label: 'Irish Pub', emoji: '☘️' },
  { id: 'cocktailbar', label: 'Cocktailbar', emoji: '🍹' },
  { id: 'weinbar', label: 'Weinbar', emoji: '🍷' },
  { id: 'biergarten', label: 'Biergarten', emoji: '🌳' },
  { id: 'brauhaus', label: 'Brauhaus', emoji: '🍻' },
  { id: 'rooftop', label: 'Rooftop', emoji: '🌇' },
  { id: 'sportsbar', label: 'Sportsbar', emoji: '⚽' },
  { id: 'shisha_bar', label: 'Shisha-Bar', emoji: '💨' },
  { id: 'sonstiges', label: 'Sonstiges', emoji: '📍' }
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export const TAG_GROUPS = [
  {
    id: 'zahlung',
    label: 'Zahlung',
    tags: [
      { id: 'nur_bar', label: 'Nur Barzahlung', emoji: '💶' },
      { id: 'karte', label: 'Kartenzahlung möglich', emoji: '💳' }
    ]
  },
  {
    id: 'sport',
    label: 'Sport',
    tags: [
      { id: 'live_fussball', label: 'Live-Fußball', emoji: '⚽' },
      { id: 'bl_konferenz', label: 'Bundesliga-Konferenz', emoji: '📺' },
      { id: 'bl_topspiel', label: 'Bundesliga-Topspiel', emoji: '🏟️' },
      { id: 'zweite_bl', label: '2. Bundesliga', emoji: '🥈' },
      { id: 'champions_league', label: 'Champions League', emoji: '🏆' },
      { id: 'anderer_sport', label: 'Anderer Live-Sport', emoji: '🏈' }
    ]
  },
  {
    id: 'rauchen',
    label: 'Rauchen',
    tags: [
      { id: 'rauchen_erlaubt', label: 'Rauchen erlaubt', emoji: '🚬' },
      { id: 'raucherbereich', label: 'Raucherbereich', emoji: '🚪' },
      { id: 'nichtraucher', label: 'Nichtraucher', emoji: '🚭' }
    ]
  },
  {
    id: 'spiele',
    label: 'Spiele',
    tags: [
      { id: 'billard', label: 'Billard', emoji: '🎱' },
      { id: 'darts', label: 'Darts', emoji: '🎯' },
      { id: 'snooker', label: 'Snooker', emoji: '🔴' },
      { id: 'kicker', label: 'Kicker', emoji: '🥅' },
      { id: 'flipper', label: 'Flipper', emoji: '🕹️' }
    ]
  },
  {
    id: 'getraenke',
    label: 'Getränke',
    tags: [
      { id: 'nur_bier', label: 'Nur Bier', emoji: '🍺' },
      { id: 'hochprozentiges', label: 'Auch Hochprozentiges', emoji: '🥃' },
      { id: 'cocktails', label: 'Cocktails', emoji: '🍹' },
      { id: 'fassbier', label: 'Fassbier', emoji: '🍻' },
      { id: 'irish_beer', label: 'Irish Beer', emoji: '☘️' },
      { id: 'alkoholfrei', label: 'Große alkoholfreie Auswahl', emoji: '🧃' }
    ]
  },
  {
    id: 'essen',
    label: 'Essen',
    tags: [
      { id: 'snacks', label: 'Snacks', emoji: '🥨' },
      { id: 'kueche', label: 'Küche', emoji: '🍽️' }
    ]
  },
  {
    id: 'programm',
    label: 'Programm',
    tags: [
      { id: 'live_musik', label: 'Live-Musik', emoji: '🎸' },
      { id: 'dj', label: 'DJ', emoji: '🎧' },
      { id: 'tanzflaeche', label: 'Tanzfläche', emoji: '💃' },
      { id: 'karaoke', label: 'Karaoke', emoji: '🎤' },
      { id: 'quiz', label: 'Kneipenquiz', emoji: '❓' }
    ]
  },
  {
    id: 'praktisches',
    label: 'Ort und Praktisches',
    tags: [
      { id: 'aussenbereich', label: 'Außenbereich', emoji: '☀️' },
      { id: 'happy_hour', label: 'Happy Hour', emoji: '⏰' },
      { id: 'eintritt', label: 'Eintritt', emoji: '🎟️' },
      { id: 'garderobe', label: 'Garderobe', emoji: '🧥' },
      { id: 'dresscode', label: 'Dresscode', emoji: '👔' },
      { id: 'lange_offen', label: 'Lange geöffnet', emoji: '🌙' },
      { id: 'gruppen', label: 'Für Gruppen geeignet', emoji: '👥' },
      { id: 'reservierung', label: 'Reservierung möglich', emoji: '📞' },
      { id: 'barrierefrei', label: 'Barrierefrei', emoji: '♿' }
    ]
  }
] as const;

export type TagId = (typeof TAG_GROUPS)[number]['tags'][number]['id'];

export const ALL_TAGS: { id: TagId; label: string; emoji: string; group: string }[] = TAG_GROUPS.flatMap((g) =>
  g.tags.map((t) => ({ ...t, group: g.id }))
);

const TAG_BY_ID = new Map(ALL_TAGS.map((t) => [t.id as string, t]));
const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id as string, c]));

export const tagInfo = (id: string) => TAG_BY_ID.get(id);
export const categoryInfo = (id: string) => CATEGORY_BY_ID.get(id) ?? CATEGORY_BY_ID.get('sonstiges')!;

/** Tags, die für den Filter „Wo läuft Sport?“ zählen */
export const SPORT_TAGS: TagId[] = TAG_GROUPS[1].tags.map((t) => t.id);

/** Preisklasse 1–4 */
export const PRICE_LEVELS = [1, 2, 3, 4] as const;
export const fmtPrice = (level: number | null | undefined) => (level ? '€'.repeat(level) : '');
