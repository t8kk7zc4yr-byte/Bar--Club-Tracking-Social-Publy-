import { APP } from '../config/app';
import { db } from './localDb';
import { getSession, signOut } from './session';
import { resetSocial } from './social';
import { resetStore } from './store';
import { supabase } from './supabase';
import { sync } from './sync';

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(b);
  });
}

/**
 * Exportiert alle eigenen Daten als JSON-Datei (Art. 15 und 20 DSGVO): Konto, Profil, Einstellungen,
 * Locations mit eigenen Angaben, Besuche samt Getränken und Ausgaben, Markierungen, Touren, Freundschaften,
 * eigene Feed-Einträge und Fotos (als eingebettete Bilddaten).
 */
export async function exportMyData(onProgress?: (msg: string) => void): Promise<void> {
  const uid = getSession().user?.id;
  if (!uid) throw new Error('Nicht angemeldet.');
  onProgress?.('Ausstehende Änderungen werden übertragen …');
  await sync();
  onProgress?.('Daten werden geladen …');
  const [profile, settings, userVenues, visits, photos, companions, tours, members, friendships, goingOut, activities] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
    supabase.from('user_settings').select('*').eq('user_id', uid).maybeSingle(),
    supabase.from('user_venues').select('*').eq('user_id', uid),
    supabase.from('visits').select('*').eq('user_id', uid),
    supabase.from('photos').select('*').eq('user_id', uid),
    supabase.from('visit_companions').select('*'),
    supabase.from('tours').select('*').eq('owner_id', uid),
    supabase.from('tour_members').select('*').eq('user_id', uid),
    supabase.from('friendships').select('*'),
    supabase.from('going_out').select('*').eq('user_id', uid).maybeSingle(),
    supabase.from('activities').select('*').eq('actor', uid)
  ]);
  const uvRows = check(userVenues) as { venue_id: string }[];
  const visitRows = check(visits) as { venue_id: string }[];
  const venueIds = [...new Set([...uvRows.map((u) => u.venue_id), ...visitRows.map((v) => v.venue_id)])];
  const venues: unknown[] = [];
  for (let i = 0; i < venueIds.length; i += 100) venues.push(...(check(await supabase.from('venues').select('*').in('id', venueIds.slice(i, i + 100))) as unknown[]));

  const photoRows = check(photos) as { id: string; storage_path: string }[];
  const photoData: Record<string, string | null> = {};
  let i = 0;
  for (const p of photoRows) {
    onProgress?.(`Foto ${++i} von ${photoRows.length} …`);
    const local = await (await db()).get('blobs', p.id);
    const blob = local ?? (await supabase.storage.from('photos').download(p.storage_path)).data;
    photoData[p.id] = blob ? await blobToDataUrl(blob) : null;
  }

  const payload = {
    app: APP.name,
    format: 1,
    exportiertAm: new Date().toISOString(),
    hinweis: 'Alle Daten, die zu deinem Konto gespeichert sind. Das Geburtsdatum wird nicht gespeichert und ist deshalb nicht enthalten.',
    konto: { id: uid, email: getSession().user?.email ?? null, angelegtAm: getSession().user?.created_at ?? null },
    profil: check(profile),
    einstellungen: check(settings),
    unterwegs: check(goingOut),
    locations: venues,
    eigeneAngabenZuLocations: uvRows,
    besuche: visitRows,
    markierungen: check(companions),
    touren: check(tours),
    tourTeilnahmen: check(members),
    freundschaften: check(friendships),
    eigeneFeedEintraege: check(activities),
    fotos: photoRows.map((p) => ({ ...p, bilddaten: photoData[p.id] }))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `social-publy-daten-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

/**
 * Löscht das Konto unwiderruflich (Art. 17 DSGVO): zuerst alle Fotodateien im Speicher,
 * dann das Konto mit allen Daten in der Datenbank, zuletzt alle Daten auf diesem Gerät.
 */
export async function deleteMyAccount(): Promise<void> {
  const uid = getSession().user?.id;
  if (!uid) throw new Error('Nicht angemeldet.');
  if (!navigator.onLine) throw new Error('Für die Löschung ist eine Internetverbindung nötig.');
  // 1. Fotodateien (die Speicher-Schnittstelle liefert höchstens 1000 Einträge je Abruf)
  for (;;) {
    const list = check(await supabase.storage.from('photos').list(uid, { limit: 1000 })) as { name: string }[];
    if (!list.length) break;
    check(await supabase.storage.from('photos').remove(list.map((f) => `${uid}/${f.name}`)));
    if (list.length < 1000) break;
  }
  // 2. Konto und alle Datenbankeinträge
  check(await supabase.rpc('delete_my_account'));
  // 3. Gerät: lokale Daten, Kartenkacheln, Anmeldung, Einstellungen
  await resetStore();
  resetSocial();
  try {
    localStorage.clear();
  } catch {
    /* privater Modus */
  }
  await signOut().catch(() => {});
}
