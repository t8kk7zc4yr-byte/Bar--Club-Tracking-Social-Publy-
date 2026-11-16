import type { CategoryId } from '../lib/tags';
import type { Venue } from '../lib/types';
import { venueFromRow } from './sync';
import { supabase } from './supabase';

/** Vorschlag aus OpenStreetMap oder aus der Ortssuche */
export interface Place {
  osmId?: string;
  name?: string;
  category: CategoryId;
  city: string;
  address: string;
  lat: number;
  lng: number;
  label?: string;
}

type Pos = { lat: number; lng: number };

function categoryFor(tags: Record<string, string | undefined>, name = ''): CategoryId {
  const a = tags.amenity ?? '';
  if (/irish/i.test(name) || tags.cuisine === 'irish') return 'irish_pub';
  if (/shisha|hookah/i.test(name) || a === 'hookah_lounge') return 'shisha_bar';
  if (a === 'nightclub') return 'club';
  if (a === 'biergarten') return 'biergarten';
  if (a === 'pub') return tags.microbrewery === 'yes' ? 'brauhaus' : 'kneipe';
  if (a === 'bar') return /cocktail/i.test(name) || tags.cocktails === 'yes' ? 'cocktailbar' : /wein|wine|vino/i.test(name) ? 'weinbar' : 'bar';
  return 'sonstiges';
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const nearbyCache = new Map<string, Place[]>();

const VENUE_TYPES = ['bar', 'pub', 'nightclub', 'biergarten', 'hookah_lounge'];

async function fetchJson(url: string, init: RequestInit | undefined, timeoutMs: number) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: c.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** Umgebungssuche über Photon (Suchdienst auf Basis von OpenStreetMap, betrieben von Komoot) */
async function photonNearby(pos: Pos, radius: number): Promise<Place[]> {
  const p = new URLSearchParams({ lat: String(pos.lat), lon: String(pos.lng), radius: String(radius / 1000), limit: '40', lang: 'de' });
  VENUE_TYPES.forEach((t) => p.append('osm_tag', `amenity:${t}`));
  const json = await fetchJson(`https://photon.komoot.io/reverse?${p}`, undefined, 8000);
  const types: Record<string, string> = { N: 'node', W: 'way', R: 'relation' };
  return (json.features ?? []).flatMap((f: any) => {
    const pr = f.properties ?? {};
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (!pr.name || lat === undefined || !types[pr.osm_type]) return [];
    const city = pr.city ?? pr.town ?? pr.village ?? '';
    const street = [pr.street, pr.housenumber].filter(Boolean).join(' ');
    return [{
      osmId: `${types[pr.osm_type]}/${pr.osm_id}`, name: pr.name, category: categoryFor({ amenity: pr.osm_value }, pr.name), city,
      address: [street, [pr.postcode, city].filter(Boolean).join(' ')].filter(Boolean).join(', '), lat, lng
    }];
  });
}

/** Reserve: Overpass-Schnittstelle von OpenStreetMap (zeitweise überlastet) */
async function overpassNearby(pos: Pos, radius: number): Promise<Place[]> {
  const q = `[out:json][timeout:10];nwr["amenity"~"^(${VENUE_TYPES.join('|')})$"]["name"](around:${radius},${pos.lat},${pos.lng});out center tags 40;`;
  const json = await fetchJson(
    'https://overpass-api.de/api/interpreter',
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) },
    10000
  );
  return (json.elements ?? []).flatMap((e: any) => {
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    const t = e.tags ?? {};
    if (lat === undefined || lng === undefined || !t.name) return [];
    const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
    const city = t['addr:city'] ?? '';
    return [{
      osmId: `${e.type}/${e.id}`, name: t.name, category: categoryFor(t, t.name), city,
      address: [street, [t['addr:postcode'], city].filter(Boolean).join(' ')].filter(Boolean).join(', '), lat, lng
    }];
  });
}

/** Bars, Kneipen, Clubs und Biergärten im Umkreis */
export async function nearbyPlaces(pos: Pos, radius = 300): Promise<Place[]> {
  const key = `${pos.lat.toFixed(3)},${pos.lng.toFixed(3)},${radius}`;
  if (nearbyCache.has(key)) return nearbyCache.get(key)!;
  let out: Place[];
  try {
    out = await photonNearby(pos, radius);
  } catch {
    out = await overpassNearby(pos, radius);
  }
  nearbyCache.set(key, out);
  return out;
}

function parseNominatim(r: any): Place {
  const a = r.address ?? {};
  const city = a.city || a.town || a.village || a.municipality || a.county || '';
  const street = [a.road, a.house_number].filter(Boolean).join(' ');
  const isVenue = r.category === 'amenity' && /^(bar|pub|nightclub|biergarten|hookah_lounge)$/.test(r.type ?? '');
  return {
    osmId: isVenue && r.osm_type && r.osm_id ? `${r.osm_type}/${r.osm_id}` : undefined,
    name: r.name || undefined,
    category: categoryFor({ amenity: r.type }, r.name ?? ''),
    city,
    address: [street, [a.postcode, city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    lat: +r.lat,
    lng: +r.lon,
    label: r.display_name
  };
}

/** Nominatim erlaubt höchstens eine Anfrage pro Sekunde; deshalb nur auf ausdrücklichen Befehl suchen */
let lastCall = 0;
async function nominatim(path: string, p: URLSearchParams) {
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const res = await fetch(`https://nominatim.openstreetmap.org/${path}?${p}`);
  if (!res.ok) throw new Error('Suche nicht verfügbar');
  return res.json();
}

export async function searchPlaces(q: string, near?: Pos | null): Promise<Place[]> {
  const p = new URLSearchParams({ q, format: 'jsonv2', addressdetails: '1', limit: '8', 'accept-language': 'de' });
  if (near) {
    const d = 0.3;
    p.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }
  return ((await nominatim('search', p)) as any[]).map(parseNominatim);
}

const reverseCache = new Map<string, Place | null>();
export async function reversePlace(lat: number, lng: number): Promise<Place | null> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (reverseCache.has(key)) return reverseCache.get(key)!;
  try {
    const p = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', addressdetails: '1', 'accept-language': 'de', zoom: '18' });
    const place = parseNominatim(await nominatim('reverse', p));
    reverseCache.set(key, place);
    return place;
  } catch {
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Locations aus dem gemeinsamen Katalog der App in der Umgebung (auch von anderen angelegte) */
export async function catalogNearby(pos: Pos, deg = 0.006): Promise<Venue[]> {
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .gte('lat', pos.lat - deg).lte('lat', pos.lat + deg)
    .gte('lng', pos.lng - deg * 1.6).lte('lng', pos.lng + deg * 1.6)
    .limit(60);
  if (error) return [];
  return (data ?? []).map(venueFromRow);
}

/** Namenssuche im gemeinsamen Katalog */
export async function catalogSearch(q: string): Promise<Venue[]> {
  const term = q.replace(/[%_,()]/g, ' ').trim();
  if (term.length < 2) return [];
  const { data, error } = await supabase.from('venues').select('*').ilike('name', `%${term}%`).limit(20);
  if (error) return [];
  return (data ?? []).map(venueFromRow);
}
