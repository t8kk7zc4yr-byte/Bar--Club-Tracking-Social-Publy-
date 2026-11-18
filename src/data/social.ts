import { useSyncExternalStore } from 'react';
import type { TagId } from '../lib/tags';
import type { Activity, CompanionStatus, Friend, Tour, Venue } from '../lib/types';
import { getState as getStore, moveVisitsToTour, rememberTour } from './store';
import { getSession } from './session';
import { venueFromRow } from './sync';
import { supabase } from './supabase';

/** Markierung durch einen Freund, die mich betrifft */
export interface CompanionRequest {
  visitId: string;
  ownerId: string;
  ownerName: string;
  venueId: string;
  venueName: string;
  city: string;
  visitedAt: string;
  status: CompanionStatus;
}

/** Angaben eines Freundes zu einer Location (nur wenn er das Teilen aktiviert hat) */
export interface FriendRating {
  userId: string;
  venueId: string;
  rating: number | null;
  tags: TagId[];
  favorite: boolean;
  wishlist: boolean;
}

/** Tour, die ich sehen kann (eigene, beigetretene oder von Freunden gestartete) */
export interface VisibleTour {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  day: string;
  members: number;
  joined: boolean;
}

export interface SocialState {
  loaded: boolean;
  friends: Friend[];
  feed: Activity[];
  requests: CompanionRequest[];
  friendRatings: FriendRating[];
  tours: VisibleTour[];
  /** Katalogeinträge zu den Bewertungen der Freunde */
  friendVenues: Record<string, Venue>;
  /** eigener „Bin unterwegs“-Status */
  goingOutUntil: string | null;
  goingOutPlace: string | null;
  /** Feed gelesen bis (nur auf diesem Gerät) */
  seenAt: string;
  error: string | null;
}

const SEEN_KEY = 'sp-feed-seen';
const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) ?? '';
  } catch {
    return '';
  }
};

const empty = (): SocialState => ({
  loaded: false, friends: [], feed: [], requests: [], friendRatings: [], tours: [], friendVenues: {}, goingOutUntil: null, goingOutPlace: null, seenAt: readSeen(), error: null
});

let state: SocialState = empty();
const listeners = new Set<() => void>();
const set = (patch: Partial<SocialState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function useSocial<T>(selector: (s: SocialState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selector(state)
  );
}
export const getSocial = () => state;
export const resetSocial = () => {
  state = empty();
  listeners.forEach((l) => l());
};

const me = () => getSession().user?.id ?? null;
const isLive = (until: string | null | undefined) => !!until && new Date(until).getTime() > Date.now();

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Zahl der Dinge, die Aufmerksamkeit brauchen: neue Feed-Einträge, Anfragen, offene Markierungen */
export function unreadCount(s: SocialState): number {
  const uid = me();
  return (
    s.feed.filter((a) => a.actorId !== uid && a.createdAt > s.seenAt).length +
    s.friends.filter((f) => f.status === 'pending_in').length +
    s.requests.filter((r) => r.status === 'pending').length
  );
}

export function markFeedSeen() {
  const seenAt = new Date().toISOString();
  try {
    localStorage.setItem(SEEN_KEY, seenAt);
  } catch {
    /* privater Modus */
  }
  set({ seenAt });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let loading: Promise<void> | null = null;

/** Lädt Freunde, Feed, Markierungen und den eigenen Status vom Server */
export function refreshSocial(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    const uid = me();
    if (!uid) return;
    try {
      const [fs, settings, outs, acts, reqs, tourRows] = await Promise.all([
        supabase.from('friendships').select('requester, addressee, status'),
        supabase.from('friend_settings').select('friend, notify_entries, notify_going_out'),
        supabase.from('going_out').select('user_id, until, place'),
        supabase.from('activities').select('id, actor, type, venue_id, venue_name, city, rating, photo_id, tour_id, created_at').order('created_at', { ascending: false }).limit(60),
        supabase.rpc('my_companion_requests'),
        supabase.rpc('visible_tours')
      ]);
      const ships = check(fs) as { requester: string; addressee: string; status: string }[];
      const ids = ships.map((f) => (f.requester === uid ? f.addressee : f.requester));
      const profiles = ids.length
        ? (check(await supabase.from('profiles').select('id, display_name, avatar_color').in('id', ids)) as any[])
        : [];
      const pById = new Map(profiles.map((p) => [p.id, p]));
      const sById = new Map((check(settings) as any[]).map((r) => [r.friend, r]));
      const oById = new Map((check(outs) as any[]).map((r) => [r.user_id, r]));

      const friends: Friend[] = ships.map((f) => {
        const other = f.requester === uid ? f.addressee : f.requester;
        const p = pById.get(other);
        const st = sById.get(other);
        const out = oById.get(other);
        return {
          id: other,
          displayName: p?.display_name ?? 'Unbekannt',
          avatarColor: p?.avatar_color ?? '#888888',
          status: f.status === 'accepted' ? 'accepted' : f.requester === uid ? 'pending_out' : 'pending_in',
          notifyEntries: st?.notify_entries ?? true,
          notifyGoingOut: st?.notify_going_out ?? true,
          goingOutUntil: isLive(out?.until) ? out.until : null,
          goingOutPlace: isLive(out?.until) ? out.place : null
        };
      });

      const feed: Activity[] = (check(acts) as any[]).map((a) => ({
        id: a.id, actorId: a.actor, type: a.type, venueId: a.venue_id, venueName: a.venue_name, city: a.city,
        rating: a.rating, photoId: a.photo_id, tourId: a.tour_id, createdAt: a.created_at
      }));

      const rawReqs = (check(reqs) as any[]) ?? [];
      const venueIds = [...new Set(rawReqs.map((r) => r.venue_id))];
      const venues = venueIds.length ? (check(await supabase.from('venues').select('id, name, city').in('id', venueIds)) as any[]) : [];
      const vById = new Map(venues.map((v) => [v.id, v]));
      const requests: CompanionRequest[] = rawReqs
        .map((r) => ({
          visitId: r.visit_id, ownerId: r.owner_id, ownerName: r.owner_name, venueId: r.venue_id,
          venueName: vById.get(r.venue_id)?.name ?? 'Unbekannte Location', city: vById.get(r.venue_id)?.city ?? '',
          visitedAt: r.visited_at, status: r.status as CompanionStatus
        }))
        .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt));

      let friendRatings: FriendRating[] = [];
      const friendVenues: Record<string, Venue> = { ...state.friendVenues };
      if (friends.some((f) => f.status === 'accepted')) {
        friendRatings = ((check(await supabase.rpc('friend_user_venues')) as any[]) ?? []).map((r) => ({
          userId: r.user_id, venueId: r.venue_id, rating: r.rating, tags: r.tags ?? [], favorite: r.favorite, wishlist: r.wishlist
        }));
        const missing = [...new Set(friendRatings.map((r) => r.venueId))].filter((id) => !friendVenues[id]);
        for (let i = 0; i < missing.length; i += 100) {
          const rows = check(await supabase.from('venues').select('*').in('id', missing.slice(i, i + 100))) as any[];
          rows.forEach((row) => (friendVenues[row.id] = venueFromRow(row)));
        }
      }

      const tours: VisibleTour[] = ((check(tourRows) as any[]) ?? [])
        .map((t) => ({ id: t.id, ownerId: t.owner_id, ownerName: t.owner_name, name: t.name, day: t.day, members: t.members, joined: t.joined }))
        .sort((a, b) => b.day.localeCompare(a.day));

      const mine = oById.get(uid);
      set({
        loaded: true, friends, feed, requests, friendRatings, friendVenues, tours, error: null,
        goingOutUntil: isLive(mine?.until) ? mine.until : null,
        goingOutPlace: isLive(mine?.until) ? mine.place : null
      });
    } catch (e) {
      set({ loaded: true, error: String((e as Error).message ?? e) });
    }
  })().finally(() => {
    loading = null;
  });
  return loading;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const acceptedFriends = (s: SocialState) => s.friends.filter((f) => f.status === 'accepted');

/** Sendet eine Anfrage per Freundescode; gibt den Namen der Person zurück */
export async function requestFriend(code: string): Promise<string> {
  const name = check(await supabase.rpc('request_friend', { p_code: code.trim().toUpperCase() })) as string;
  await refreshSocial();
  return name;
}

export async function acceptFriend(friendId: string) {
  check(await supabase.from('friendships').update({ status: 'accepted' }).eq('requester', friendId).eq('addressee', me()));
  await refreshSocial();
}

/** Beendet eine Freundschaft oder zieht eine Anfrage zurück bzw. lehnt sie ab */
export async function removeFriend(friendId: string) {
  const uid = me();
  check(await supabase.from('friendships').delete().or(`and(requester.eq.${uid},addressee.eq.${friendId}),and(requester.eq.${friendId},addressee.eq.${uid})`));
  await supabase.from('friend_settings').delete().eq('owner', uid).eq('friend', friendId);
  await refreshSocial();
}

export async function setFriendNotify(friendId: string, patch: { notifyEntries?: boolean; notifyGoingOut?: boolean }) {
  const f = state.friends.find((x) => x.id === friendId);
  if (!f) return;
  const next = { ...f, ...patch };
  set({ friends: state.friends.map((x) => (x.id === friendId ? next : x)) });
  check(
    await supabase.from('friend_settings').upsert(
      { owner: me(), friend: friendId, notify_entries: next.notifyEntries, notify_going_out: next.notifyGoingOut },
      { onConflict: 'owner,friend' }
    )
  );
}

/** Setzt „Bin unterwegs“ für die angegebene Dauer; hours = null beendet den Status */
export async function setGoingOut(hours: number | null, place?: string) {
  const until = hours ? new Date(Date.now() + hours * 3600 * 1000).toISOString() : null;
  check(await supabase.from('going_out').upsert({ user_id: me(), until, place: until ? place?.trim().slice(0, 80) || null : null }, { onConflict: 'user_id' }));
  set({ goingOutUntil: until, goingOutPlace: until ? place?.trim() || null : null });
}

export async function answerCompanion(visitId: string, status: 'accepted' | 'declined') {
  check(await supabase.from('visit_companions').update({ status }).eq('visit_id', visitId).eq('user_id', me()));
  set({ requests: state.requests.map((r) => (r.visitId === visitId ? { ...r, status } : r)) });
}

/** Entfernt eine Markierung endgültig (als markierte Person) */
export async function removeCompanionTag(visitId: string) {
  check(await supabase.from('visit_companions').delete().eq('visit_id', visitId).eq('user_id', me()));
  set({ requests: state.requests.filter((r) => r.visitId !== visitId) });
}

export async function fetchVenue(id: string): Promise<Venue | null> {
  const { data } = await supabase.from('venues').select('*').eq('id', id).maybeSingle();
  return data ? venueFromRow(data) : null;
}

/** Freigegebene Fotos eines Freundes zu einem Feed-Eintrag: zeitlich begrenzte Adresse */
const sharedUrlCache = new Map<string, string | null>();
export async function sharedPhotoUrl(photoId: string): Promise<string | null> {
  if (sharedUrlCache.has(photoId)) return sharedUrlCache.get(photoId)!;
  let url: string | null = null;
  const { data } = await supabase.from('photos').select('storage_path').eq('id', photoId).maybeSingle();
  if (data?.storage_path) {
    const signed = await supabase.storage.from('photos').createSignedUrl(data.storage_path, 3600);
    url = signed.data?.signedUrl ?? null;
  }
  sharedUrlCache.set(photoId, url);
  return url;
}

/** Zusammenfassung der Freundes-Angaben zu einer Location */
export interface FriendSummary {
  venueId: string;
  entries: (FriendRating & { name: string; color: string })[];
  avg: number | null;
  tags: TagId[];
}

export function summarizeFriends(s: SocialState): Map<string, FriendSummary> {
  const names = new Map(s.friends.filter((f) => f.status === 'accepted').map((f) => [f.id, f]));
  const out = new Map<string, FriendSummary>();
  for (const r of s.friendRatings) {
    const f = names.get(r.userId);
    if (!f) continue;
    const sum = out.get(r.venueId) ?? { venueId: r.venueId, entries: [], avg: null, tags: [] };
    sum.entries.push({ ...r, name: f.displayName, color: f.avatarColor });
    out.set(r.venueId, sum);
  }
  for (const sum of out.values()) {
    const rated = sum.entries.filter((e) => e.rating !== null);
    sum.avg = rated.length ? rated.reduce((a, e) => a + e.rating!, 0) / rated.length : null;
    sum.tags = [...new Set(sum.entries.flatMap((e) => e.tags))];
  }
  return out;
}

let summaryCache: { ratings: FriendRating[]; friends: Friend[]; out: Map<string, FriendSummary> } | null = null;
/** Stabile Referenz für React */
export function friendSummaries(s: SocialState): Map<string, FriendSummary> {
  if (summaryCache && summaryCache.ratings === s.friendRatings && summaryCache.friends === s.friends) return summaryCache.out;
  const out = summarizeFriends(s);
  summaryCache = { ratings: s.friendRatings, friends: s.friends, out };
  return out;
}

/** Einer Tour eines Freundes beitreten; eigene Besuche dieses Abends werden ihr zugeordnet */
export async function joinTour(t: VisibleTour) {
  check(await supabase.from('tour_members').insert({ tour_id: t.id, user_id: me() }));
  const tour: Tour = { id: t.id, ownerId: t.ownerId, name: t.name, day: t.day, createdAt: new Date().toISOString() };
  await rememberTour(tour);
  await moveVisitsToTour(t.day, t.id);
  await refreshSocial();
}

/** Tour eines Freundes verlassen; die eigenen Besuche bleiben erhalten, nur ohne Tour */
export async function leaveTour(t: { id: string; day: string }) {
  check(await supabase.from('tour_members').delete().eq('tour_id', t.id).eq('user_id', me()));
  const night = getStore().visits.filter((v) => v.tourId === t.id);
  await rememberTour(null, t.id);
  if (night.length) await moveVisitsToTour(t.day, null);
  await refreshSocial();
}

/** Stationen einer Tour aller Teilnehmer (nur online; ohne private Angaben) */
export interface TourStop {
  visitId: string;
  userId: string;
  name: string;
  venueId: string;
  visitedAt: string;
  rating: number | null;
}
export async function fetchTourStops(tourId: string): Promise<{ stops: TourStop[]; venues: Record<string, Venue> }> {
  const rows = (check(await supabase.rpc('tour_visits', { p_tour: tourId })) as any[]) ?? [];
  const stops: TourStop[] = rows.map((r) => ({ visitId: r.id, userId: r.user_id, name: r.display_name, venueId: r.venue_id, visitedAt: r.visited_at, rating: r.rating }));
  const ids = [...new Set(stops.map((x) => x.venueId))];
  const venues: Record<string, Venue> = {};
  if (ids.length) (check(await supabase.from('venues').select('*').in('id', ids)) as any[]).forEach((v) => (venues[v.id] = venueFromRow(v)));
  return { stops: stops.sort((a, b) => a.visitedAt.localeCompare(b.visitedAt)), venues };
}
