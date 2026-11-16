/** Bewertungsskala 1–10 (ganze Zahlen); null = noch nicht bewertet */
export const RATING_MIN = 1;
export const RATING_MAX = 10;
export const RATING_VALUES = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);

export interface RatingTier {
  key: 'none' | 'bad' | 'ok' | 'good' | 'top';
  label: string;
  color: string;
  text: string;
}

export const TIERS: Record<RatingTier['key'], RatingTier> = {
  none: { key: 'none', label: 'Unbewertet', color: '#6b6880', text: '#ffffff' },
  bad: { key: 'bad', label: 'Mies (1–3)', color: '#ef4444', text: '#ffffff' },
  ok: { key: 'ok', label: 'Okay (4–6)', color: '#fde047', text: '#1a1400' },
  good: { key: 'good', label: 'Gut (7–9)', color: '#4ade80', text: '#04210f' },
  top: { key: 'top', label: 'Legendär (10)', color: '#d99a00', text: '#2a1c00' }
};

export function isValidRating(r: unknown): r is number {
  return typeof r === 'number' && Number.isInteger(r) && r >= RATING_MIN && r <= RATING_MAX;
}

/** Farbstufe; funktioniert auch für Durchschnitte wie 7,2 */
export function tierFor(r: number | null | undefined): RatingTier {
  if (r === null || r === undefined || Number.isNaN(r)) return TIERS.none;
  if (r >= 10) return TIERS.top;
  if (r >= 7) return TIERS.good;
  if (r >= 4) return TIERS.ok;
  return TIERS.bad;
}

export function fmtRating(r: number | null | undefined): string {
  if (r === null || r === undefined || Number.isNaN(r)) return '–';
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
}
