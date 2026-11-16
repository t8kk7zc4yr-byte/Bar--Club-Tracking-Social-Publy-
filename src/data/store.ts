import { useSyncExternalStore } from 'react';
import { compressImage } from '../lib/image';
import type { Photo, UserVenue, Venue, Visit } from '../lib/types';
import { uid } from '../lib/util';
import { clearLocal, db, type OutboxOp } from './localDb';

export interface State {
  loaded: boolean;
  userId: string | null;
  venues: Venue[];
  userVenues: UserVenue[];
  visits: Visit[];
  photos: Photo[];
  /** Anzahl noch nicht übertragener Änderungen */
  pending: number;
  syncing: boolean;
  syncError: string | null;
}

const empty = (): State => ({
  loaded: false, userId: null, venues: [], userVenues: [], visits: [], photos: [], pending: 0, syncing: false, syncError: null
});

let state: State = empty();
const listeners = new Set<() => void>();
export const setState = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selector(state)
  );
}
export const getState = () => state;

/** Wird von sync.ts gesetzt; so bleibt der Store frei von Netzwerkcode */
let kick: () => void = () => {};
export const setSyncKick = (fn: () => void) => {
  kick = fn;
};

const now = () => new Date().toISOString();

async function enqueue(...ops: OutboxOp[]) {
  const d = await db();
  for (const op of ops) await d.add('outbox', { op, attempts: 0 });
  setState({ pending: await d.count('outbox') });
  kick();
}

/** Lädt die lokalen Daten des angemeldeten Kontos; fremde Daten werden vorher entfernt */
export async function initStore(userId: string) {
  if (state.loaded && state.userId === userId) return;
  const d = await db();
  if ((await d.get('meta', 'userId')) !== userId) {
    await clearLocal();
    await d.put('meta', userId, 'userId');
  }
  const [venues, userVenues, visits, photos, pending] = await Promise.all([
    d.getAll('venues'), d.getAll('userVenues'), d.getAll('visits'), d.getAll('photos'), d.count('outbox')
  ]);
  setState({ loaded: true, userId, venues, userVenues, visits, photos, pending });
  kick();
}

export async function resetStore() {
  urlCache.forEach((u) => u.startsWith('blob:') && URL.revokeObjectURL(u));
  urlCache.clear();
  await clearLocal();
  try {
    // besuchte Kartenausschnitte verraten Aufenthaltsorte, daher mitlöschen
    await caches?.delete('osm-tiles');
  } catch {
    /* Cache API nicht verfügbar */
  }
  state = empty();
  listeners.forEach((l) => l());
}

/* ---------- Abgeleitete Sicht: Location samt persönlicher Angaben ---------- */

export interface VenueView extends Venue {
  rating: number | null;
  tags: UserVenue['tags'];
  priceLevel: number | null;
  foodNote: string | null;
  review: string | null;
  favorite: boolean;
  wishlist: boolean;
  coverPhotoId: string | null;
}

export function toView(v: Venue, uv?: UserVenue): VenueView {
  return {
    ...v,
    rating: uv?.rating ?? null,
    tags: uv?.tags ?? [],
    priceLevel: uv?.priceLevel ?? null,
    foodNote: uv?.foodNote ?? null,
    review: uv?.review ?? null,
    favorite: uv?.favorite ?? false,
    wishlist: uv?.wishlist ?? false,
    coverPhotoId: uv?.coverPhotoId ?? null
  };
}

let viewCache: { venues: Venue[]; userVenues: UserVenue[]; out: VenueView[] } | null = null;
/** Alle Locations, zu denen es persönliche Angaben gibt (stabile Referenz für React) */
export function myVenues(s: State): VenueView[] {
  if (viewCache && viewCache.venues === s.venues && viewCache.userVenues === s.userVenues) return viewCache.out;
  const byId = new Map(s.venues.map((v) => [v.id, v]));
  const out = s.userVenues.flatMap((uv) => {
    const v = byId.get(uv.venueId);
    return v ? [toView(v, uv)] : [];
  });
  viewCache = { venues: s.venues, userVenues: s.userVenues, out };
  return out;
}

export const venueView = (s: State, id: string | null | undefined): VenueView | undefined => {
  const v = s.venues.find((x) => x.id === id);
  return v ? toView(v, s.userVenues.find((u) => u.venueId === id)) : undefined;
};

/* ---------- Locations ---------- */

export type NewVenue = Pick<Venue, 'name' | 'category' | 'city'> & Partial<Pick<Venue, 'id' | 'address' | 'lat' | 'lng' | 'osmId'>>;

/** Legt eine Location im Katalog an (oder verwendet die vorhandene mit gleicher OpenStreetMap-Kennung) */
export async function addVenue(input: NewVenue, personal: Partial<UserVenue> | null = {}): Promise<string> {
  const existing = state.venues.find((v) => (input.id && v.id === input.id) || (input.osmId && v.osmId === input.osmId));
  const d = await db();
  let id = existing?.id;
  const ops: OutboxOp[] = [];
  if (!existing) {
    const venue: Venue = {
      id: input.id ?? uid(),
      name: input.name.trim(),
      category: input.category,
      city: input.city.trim(),
      address: input.address?.trim() || null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      osmId: input.osmId ?? null,
      createdBy: state.userId,
      createdAt: now(),
      updatedAt: now()
    };
    id = venue.id;
    await d.put('venues', venue);
    setState({ venues: [...state.venues, venue] });
    ops.push({ kind: 'venue', id: venue.id });
  }
  await enqueue(...ops);
  if (personal) await patchUserVenue(id!, personal);
  return id!;
}

/** Übernimmt eine Location aus dem gemeinsamen Katalog (bereits auf dem Server vorhanden) */
export async function adoptVenue(venue: Venue, personal: Partial<UserVenue> | null = {}): Promise<string> {
  if (!state.venues.some((v) => v.id === venue.id)) {
    await (await db()).put('venues', venue);
    setState({ venues: [...state.venues, venue] });
  }
  if (personal) await patchUserVenue(venue.id, personal);
  return venue.id;
}

export async function patchUserVenue(venueId: string, patch: Partial<UserVenue>) {
  const old = state.userVenues.find((u) => u.venueId === venueId);
  const uv: UserVenue = {
    userId: state.userId!,
    venueId,
    rating: null,
    tags: [],
    favorite: false,
    wishlist: false,
    ...old,
    ...patch,
    updatedAt: now(),
    deletedAt: null
  };
  await (await db()).put('userVenues', uv);
  setState({ userVenues: old ? state.userVenues.map((u) => (u.venueId === venueId ? uv : u)) : [...state.userVenues, uv] });
  await enqueue({ kind: 'userVenue', venueId });
}

/* ---------- Besuche ---------- */

export async function saveVisit(v: Omit<Visit, 'userId' | 'updatedAt'>) {
  const visit: Visit = { ...v, userId: state.userId!, updatedAt: now(), deletedAt: null };
  const exists = state.visits.some((x) => x.id === v.id);
  await (await db()).put('visits', visit);
  setState({ visits: exists ? state.visits.map((x) => (x.id === v.id ? visit : x)) : [...state.visits, visit] });
  await enqueue({ kind: 'visit', id: visit.id });
  // Wunschliste verlassen, sobald man dort war
  const uv = state.userVenues.find((u) => u.venueId === v.venueId);
  if (!uv || uv.wishlist) await patchUserVenue(v.venueId, { wishlist: false });
}

export async function deleteVisit(id: string) {
  const d = await db();
  for (const p of state.photos.filter((x) => x.visitId === id)) await deletePhoto(p.id);
  await d.delete('visits', id);
  setState({ visits: state.visits.filter((v) => v.id !== id) });
  await enqueue({ kind: 'visitDelete', id });
}

/* ---------- Fotos ---------- */

const urlCache = new Map<string, string>();
/** Wird von sync.ts gesetzt: liefert eine zeitlich begrenzte Adresse für ein hochgeladenes Foto */
let remoteUrl: (path: string) => Promise<string | null> = async () => null;
export const setRemoteUrl = (fn: typeof remoteUrl) => {
  remoteUrl = fn;
};

export async function addPhoto(file: File, venueId: string, visitId?: string): Promise<string> {
  // Verkleinern und neu kodieren; dabei entfallen Standort- und Gerätedaten (EXIF)
  const blob = await compressImage(file);
  const id = uid();
  const photo: Photo = {
    id, userId: state.userId!, venueId, visitId: visitId ?? null,
    storagePath: `${state.userId}/${id}.jpg`, shared: false, createdAt: now(), deletedAt: null
  };
  const d = await db();
  await d.put('blobs', blob, id);
  await d.put('photos', photo);
  setState({ photos: [...state.photos, photo] });
  await enqueue({ kind: 'photo', id });
  return id;
}

export async function deletePhoto(id: string) {
  const photo = state.photos.find((p) => p.id === id);
  if (!photo) return;
  const d = await db();
  await d.delete('photos', id);
  await d.delete('blobs', id);
  const u = urlCache.get(id);
  if (u?.startsWith('blob:')) URL.revokeObjectURL(u);
  urlCache.delete(id);
  setState({ photos: state.photos.filter((p) => p.id !== id) });
  await enqueue({ kind: 'photoDelete', id, storagePath: photo.storagePath });
}

export async function photoUrl(id: string): Promise<string | null> {
  if (urlCache.has(id)) return urlCache.get(id)!;
  const blob = await (await db()).get('blobs', id);
  let url: string | null = null;
  if (blob) url = URL.createObjectURL(blob);
  else {
    const photo = state.photos.find((p) => p.id === id);
    if (photo) url = await remoteUrl(photo.storagePath);
  }
  if (url) urlCache.set(id, url);
  return url;
}
