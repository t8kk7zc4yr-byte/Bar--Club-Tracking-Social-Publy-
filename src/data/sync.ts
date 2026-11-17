import type { Photo, UserVenue, Venue, Visit } from '../lib/types';
import { db, type OutboxEntry } from './localDb';
import { getState, setRemoteUrl, setState, setSyncKick } from './store';
import { supabase } from './supabase';

/* ---------- Umwandlung zwischen App und Datenbank ---------- */

/* eslint-disable @typescript-eslint/no-explicit-any */
export const venueFromRow = (r: any): Venue => ({
  id: r.id, name: r.name, category: r.category, city: r.city, address: r.address, lat: r.lat, lng: r.lng,
  osmId: r.osm_id, createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at
});

const userVenueFromRow = (r: any): UserVenue => ({
  userId: r.user_id, venueId: r.venue_id, rating: r.rating, review: r.review, tags: r.tags ?? [],
  priceLevel: r.price_level, foodNote: r.food_note, favorite: r.favorite, wishlist: r.wishlist,
  coverPhotoId: r.cover_photo, updatedAt: r.updated_at, deletedAt: r.deleted_at
});

const visitFromRow = (r: any): Visit => ({
  id: r.id, userId: r.user_id, venueId: r.venue_id, visitedAt: r.visited_at, rating: r.rating, note: r.note,
  drinks: r.drinks ?? [], spend: r.spend === null ? null : Number(r.spend), companionsText: r.companions_text ?? [],
  tourId: r.tour_id, updatedAt: r.updated_at, deletedAt: r.deleted_at
});

const photoFromRow = (r: any): Photo => ({
  id: r.id, userId: r.user_id, venueId: r.venue_id, visitId: r.visit_id, storagePath: r.storage_path,
  shared: r.shared, createdAt: r.created_at, deletedAt: r.deleted_at
});
/* eslint-enable @typescript-eslint/no-explicit-any */

const isNetworkError = (e: unknown) => {
  const msg = String((e as { message?: string })?.message ?? e);
  return !navigator.onLine || /fetch|network|load failed|timeout/i.test(msg);
};

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Ersetzt eine lokal vergebene Location-ID durch die des Servers (gleiche OpenStreetMap-Kennung existierte schon) */
async function remapVenue(oldId: string, newId: string) {
  const d = await db();
  const s = getState();
  const { data } = await supabase.from('venues').select('*').eq('id', newId).maybeSingle();
  const old = s.venues.find((v) => v.id === oldId);
  const venue = data ? venueFromRow(data) : old ? { ...old, id: newId } : null;
  const tx = d.transaction(['venues', 'userVenues', 'visits', 'photos', 'outbox'], 'readwrite');
  await tx.objectStore('venues').delete(oldId);
  if (venue) await tx.objectStore('venues').put(venue);
  const uv = await tx.objectStore('userVenues').get(oldId);
  if (uv) {
    await tx.objectStore('userVenues').delete(oldId);
    if (!(await tx.objectStore('userVenues').get(newId))) await tx.objectStore('userVenues').put({ ...uv, venueId: newId });
  }
  for (const v of await tx.objectStore('visits').getAll()) if (v.venueId === oldId) await tx.objectStore('visits').put({ ...v, venueId: newId });
  for (const p of await tx.objectStore('photos').getAll()) if (p.venueId === oldId) await tx.objectStore('photos').put({ ...p, venueId: newId });
  for (const o of await tx.objectStore('outbox').getAll()) {
    if (o.op.kind === 'userVenue' && o.op.venueId === oldId) await tx.objectStore('outbox').put({ ...o, op: { kind: 'userVenue', venueId: newId } });
  }
  await tx.done;
  const [venues, userVenues, visits, photos] = await Promise.all([d.getAll('venues'), d.getAll('userVenues'), d.getAll('visits'), d.getAll('photos')]);
  setState({ venues, userVenues, visits, photos });
}

async function send(entry: OutboxEntry) {
  const s = getState();
  const uid = s.userId!;
  const op = entry.op;
  switch (op.kind) {
    case 'venue': {
      const v = s.venues.find((x) => x.id === op.id);
      if (!v) return;
      const id = check(
        await supabase.rpc('upsert_venue', {
          p_id: v.id, p_name: v.name, p_category: v.category, p_city: v.city, p_address: v.address ?? null,
          p_lat: v.lat ?? null, p_lng: v.lng ?? null, p_osm_id: v.osmId ?? null
        })
      ) as string;
      if (id && id !== v.id) await remapVenue(v.id, id);
      return;
    }
    case 'userVenue': {
      const u = s.userVenues.find((x) => x.venueId === op.venueId);
      if (!u) return;
      check(
        await supabase.from('user_venues').upsert(
          {
            user_id: uid, venue_id: u.venueId, rating: u.rating, review: u.review ?? null, tags: u.tags,
            price_level: u.priceLevel ?? null, food_note: u.foodNote ?? null, favorite: u.favorite, wishlist: u.wishlist,
            cover_photo: u.coverPhotoId ?? null, deleted_at: u.deletedAt ?? null
          },
          { onConflict: 'user_id,venue_id' }
        )
      );
      return;
    }
    case 'visit': {
      const v = s.visits.find((x) => x.id === op.id);
      if (!v) return;
      check(
        await supabase.from('visits').upsert({
          id: v.id, user_id: uid, venue_id: v.venueId, visited_at: v.visitedAt, rating: v.rating ?? null, note: v.note ?? null,
          drinks: v.drinks, spend: v.spend ?? null, companions_text: v.companionsText, tour_id: v.tourId ?? null, deleted_at: null
        })
      );
      return;
    }
    case 'visitDelete':
      // endgültig löschen, damit keine Reste auf dem Server bleiben
      check(await supabase.from('visits').delete().eq('id', op.id));
      return;
    case 'photo': {
      const p = s.photos.find((x) => x.id === op.id);
      if (!p) return;
      const blob = await (await db()).get('blobs', p.id);
      if (blob) {
        const up = await supabase.storage.from('photos').upload(p.storagePath, blob, { contentType: 'image/jpeg', upsert: true });
        if (up.error) throw new Error(up.error.message);
      }
      check(
        await supabase.from('photos').upsert({
          id: p.id, user_id: uid, venue_id: p.venueId, visit_id: p.visitId ?? null, storage_path: p.storagePath, shared: p.shared, deleted_at: null
        })
      );
      return;
    }
    case 'photoDelete':
      check(await supabase.from('photos').delete().eq('id', op.id));
      await supabase.storage.from('photos').remove([op.storagePath]);
      return;
  }
}

/** Holt den Stand des Kontos vom Server; nur wenn lokal nichts mehr aussteht */
async function pull() {
  const uid = getState().userId;
  if (!uid) return;
  const [uvRows, visitRows, photoRows] = await Promise.all([
    supabase.from('user_venues').select('*').eq('user_id', uid).is('deleted_at', null),
    supabase.from('visits').select('*').eq('user_id', uid).is('deleted_at', null),
    supabase.from('photos').select('*').eq('user_id', uid).is('deleted_at', null)
  ]);
  const userVenues = (check(uvRows) as unknown[]).map(userVenueFromRow);
  const visits = (check(visitRows) as unknown[]).map(visitFromRow);
  const photos = (check(photoRows) as unknown[]).map(photoFromRow);
  const ids = [...new Set([...userVenues.map((u) => u.venueId), ...visits.map((v) => v.venueId)])];
  const venues: Venue[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const rows = check(await supabase.from('venues').select('*').in('id', ids.slice(i, i + 100))) as unknown[];
    venues.push(...rows.map(venueFromRow));
  }
  const d = await db();
  // Zwischenzeitlich neue lokale Änderungen haben Vorrang
  if ((await d.count('outbox')) > 0 || getState().userId !== uid) return;
  const tx = d.transaction(['venues', 'userVenues', 'visits', 'photos'], 'readwrite');
  await Promise.all([
    tx.objectStore('venues').clear(), tx.objectStore('userVenues').clear(), tx.objectStore('visits').clear(), tx.objectStore('photos').clear()
  ]);
  for (const v of venues) tx.objectStore('venues').put(v);
  for (const u of userVenues) tx.objectStore('userVenues').put(u);
  for (const v of visits) tx.objectStore('visits').put(v);
  for (const p of photos) tx.objectStore('photos').put(p);
  await tx.done;
  setState({ venues, userVenues, visits, photos });
}

let running = false;
let again = false;

/** Sendet ausstehende Änderungen der Reihe nach und gleicht danach mit dem Server ab */
export async function sync(withPull = false) {
  if (running) {
    again = true;
    return;
  }
  if (!getState().loaded || !getState().userId) return;
  running = true;
  setState({ syncing: true });
  try {
    const d = await db();
    for (;;) {
      const entries = await d.getAll('outbox', undefined, 1);
      const entry = entries[0];
      if (!entry) break;
      try {
        await send(entry);
        await d.delete('outbox', entry.seq!);
      } catch (e) {
        if (isNetworkError(e)) throw e;
        // Dauerhafter Fehler: einige Male versuchen, dann verwerfen, damit die Warteschlange nicht blockiert
        if (entry.attempts >= 4) await d.delete('outbox', entry.seq!);
        else await d.put('outbox', { ...entry, attempts: entry.attempts + 1 });
        setState({ syncError: String((e as Error).message ?? e) });
        console.error('Abgleich fehlgeschlagen', entry.op, e);
        if (entry.attempts < 4) break;
      }
      setState({ pending: await d.count('outbox') });
    }
    const pending = await d.count('outbox');
    setState({ pending });
    if (pending === 0) {
      setState({ syncError: null });
      if (withPull) await pull();
    }
  } catch (e) {
    if (!isNetworkError(e)) setState({ syncError: String((e as Error).message ?? e) });
  } finally {
    running = false;
    setState({ syncing: false });
    if (again) {
      again = false;
      void sync(withPull);
    }
  }
}

let started = false;
export function startSync() {
  setSyncKick(() => void sync());
  setRemoteUrl(async (path) => {
    const { data } = await supabase.storage.from('photos').createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  });
  if (started) return;
  started = true;
  window.addEventListener('online', () => void sync(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sync(true);
  });
}
