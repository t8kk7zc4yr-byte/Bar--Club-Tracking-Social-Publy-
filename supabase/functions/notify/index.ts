// Social Publy: Server-Funktion „notify“ (Supabase Edge Function, Deno)
//
// Wird von der Datenbank aufgerufen (siehe supabase/migrations/0004_push.sql), wenn ein Feed-Eintrag,
// eine Markierung oder eine Freundschaftsanfrage entsteht. Der Aufruf enthält nur die Kennung des Eintrags.
// Die Funktion liest den Eintrag selbst aus der Datenbank und beansprucht ihn über „pushed_at“, bevor sie
// versendet. Dadurch geht jede Benachrichtigung höchstens einmal hinaus, und ein Fremder, der die Funktion
// aufruft, kann keine erfundenen Nachrichten auslösen. Deshalb darf die JWT-Prüfung abgeschaltet sein.
//
// Benötigte Secrets (Supabase Dashboard > Edge Functions > Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase automatisch bereit.
//
// Die Verschlüsselung (RFC 8291, aes128gcm) und die Absenderkennung (VAPID, RFC 8292) nutzen nur WebCrypto,
// damit die Funktion ohne zusätzliche Bibliotheken läuft.

/* ------------------------------------------------------------------ */
/* Hilfsfunktionen                                                     */
/* ------------------------------------------------------------------ */

const enc = new TextEncoder();

export function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

/* ------------------------------------------------------------------ */
/* Verschlüsselung der Nachricht (RFC 8291 / RFC 8188, aes128gcm)      */
/* ------------------------------------------------------------------ */

export interface PushSubscription {
  endpoint: string;
  /** öffentlicher Schlüssel des Geräts, base64url (65 Byte, unkomprimiert) */
  p256dh: string;
  /** Authentifizierungsgeheimnis des Geräts, base64url (16 Byte) */
  auth: string;
}

/** Verschlüsselt den Inhalt für genau ein Gerät; liefert den Rumpf der Push-Anfrage */
export async function encryptPayload(sub: PushSubscription, plaintext: Uint8Array, salt = crypto.getRandomValues(new Uint8Array(16))): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(sub.p256dh);
  const authSecret = b64urlDecode(sub.auth);

  // Einmaliges Schlüsselpaar des Absenders
  const asKeys = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));

  // Schlüsselableitung nach RFC 8291, Abschnitt 3.4
  const prkKey = await hmac(authSecret, ecdhSecret);
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = (await hmac(prkKey, concat(keyInfo, new Uint8Array([1])))).slice(0, 32);
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, enc.encode('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16);
  const nonce = (await hmac(prk, enc.encode('Content-Encoding: nonce\0\x01'))).slice(0, 12);

  // Ein einziger Datensatz, abgeschlossen mit dem Trennzeichen 0x02
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(plaintext, new Uint8Array([2]))));

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

/* ------------------------------------------------------------------ */
/* Absenderkennung (VAPID, RFC 8292)                                   */
/* ------------------------------------------------------------------ */

export async function vapidHeader(endpoint: string, publicKey: string, privateKey: string, subject: string, now = Date.now()): Promise<string> {
  const pub = b64urlDecode(publicKey);
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: b64urlEncode(pub.slice(1, 33)),
    y: b64urlEncode(pub.slice(33, 65)),
    d: privateKey,
    ext: false
  };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64urlEncode(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject }))
  );
  // WebCrypto liefert die Signatur bereits im für JWT nötigen Format (r und s, je 32 Byte)
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${b64urlEncode(sig)}, k=${publicKey}`;
}

export interface Message {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/** Sendet eine Nachricht an ein Gerät. Rückgabe: HTTP-Status des Push-Dienstes */
export async function sendPush(sub: PushSubscription, msg: Message, vapid: { publicKey: string; privateKey: string; subject: string }): Promise<number> {
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(msg)));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(sub.endpoint, vapid.publicKey, vapid.privateKey, vapid.subject),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(6 * 3600),
      Urgency: 'normal'
    },
    body
  });
  await res.body?.cancel();
  return res.status;
}

/* ------------------------------------------------------------------ */
/* Texte                                                               */
/* ------------------------------------------------------------------ */

export interface ActivityRow {
  id: string;
  actor: string;
  type: 'checkin' | 'new_venue' | 'going_out' | 'rating' | 'photo' | 'tour';
  venue_name: string | null;
  city: string | null;
  rating: number | null;
  tour_id: string | null;
  created_at: string;
}

export function activityMessage(a: ActivityRow, name: string): Message {
  const where = [a.venue_name, a.city].filter(Boolean).join(' · ');
  const rated = a.rating ? ` · ${a.rating}/10` : '';
  switch (a.type) {
    case 'checkin': return { title: `${name} ist eingecheckt 🍻`, body: where + rated, url: './#/freunde', tag: `a-${a.actor}` };
    case 'new_venue': return { title: `${name} war zum ersten Mal hier`, body: where + rated, url: './#/freunde', tag: `a-${a.actor}` };
    case 'rating': return { title: `${name} hat bewertet`, body: where + rated, url: './#/freunde', tag: `a-${a.actor}` };
    case 'photo': return { title: `${name} hat ein Foto geteilt`, body: where, url: './#/freunde', tag: `a-${a.actor}` };
    case 'going_out': return { title: `${name} ist unterwegs`, body: a.venue_name ? `📍 ${a.venue_name}` : 'Lust mitzukommen?', url: './#/freunde', tag: `g-${a.actor}` };
    case 'tour': return { title: `${name} startet eine Kneipentour`, body: a.venue_name ?? '', url: a.tour_id ? `./#/tour/${a.tour_id}` : './#/freunde', tag: `t-${a.actor}` };
  }
}

/** Welche Einstellung je Freund für diese Art von Eintrag gilt */
export const settingFor = (type: ActivityRow['type']) => (type === 'going_out' ? 'notify_going_out' : 'notify_entries');

/* ------------------------------------------------------------------ */
/* Datenbankzugriff über die REST-Schnittstelle mit Dienstschlüssel    */
/* ------------------------------------------------------------------ */

type Env = { url: string; key: string };

async function rest<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { apikey: env.key, 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) };
  // Ältere Dienstschlüssel sind JWTs und gehören zusätzlich in den Authorization-Kopf
  if (env.key.split('.').length === 3) headers.Authorization = `Bearer ${env.key}`;
  const res = await fetch(`${env.url}/rest/v1/${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Beansprucht einen Eintrag: liefert ihn nur, wenn er noch nicht versendet wurde */
async function claim<T>(env: Env, table: string, filter: string): Promise<T | null> {
  const rows = await rest<T[]>(env, `${table}?${filter}&pushed_at=is.null`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ pushed_at: new Date().toISOString() })
  });
  return rows[0] ?? null;
}

const inList = (ids: string[]) => `(${ids.map((i) => encodeURIComponent(i)).join(',')})`;
const isUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s);

async function displayName(env: Env, id: string): Promise<string> {
  const rows = await rest<{ display_name: string }[]>(env, `profiles?id=eq.${id}&select=display_name`);
  return rows[0]?.display_name ?? 'Ein Freund';
}

async function deliver(env: Env, userIds: string[], msg: Message, vapid: { publicKey: string; privateKey: string; subject: string }) {
  if (!userIds.length) return { sent: 0, removed: 0 };
  const subs = await rest<(PushSubscription & { id: string })[]>(env, `push_subscriptions?owner=in.${inList(userIds)}&select=id,endpoint,p256dh,auth`);
  let sent = 0;
  let removed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        const status = await sendPush(s, msg, vapid);
        if (status >= 200 && status < 300) sent++;
        // Abgelaufene oder abgemeldete Geräte entfernen
        if (status === 404 || status === 410) {
          await rest(env, `push_subscriptions?id=eq.${s.id}`, { method: 'DELETE' });
          removed++;
        }
      } catch (e) {
        console.error('Push fehlgeschlagen', e);
      }
    })
  );
  return { sent, removed };
}

/** Verarbeitet einen Aufruf aus der Datenbank */
export async function handle(input: Record<string, unknown>, env: Env, vapid: { publicKey: string; privateKey: string; subject: string }) {
  const maxAge = 15 * 60 * 1000;

  if (input.table === 'activities' && isUuid(input.id)) {
    const a = await claim<ActivityRow>(env, 'activities', `id=eq.${input.id}`);
    if (!a || Date.now() - new Date(a.created_at).getTime() > maxAge) return { skipped: true };
    const ships = await rest<{ requester: string; addressee: string }[]>(
      env,
      `friendships?status=eq.accepted&or=(requester.eq.${a.actor},addressee.eq.${a.actor})&select=requester,addressee`
    );
    const friends = ships.map((f) => (f.requester === a.actor ? f.addressee : f.requester));
    if (!friends.length) return { sent: 0 };
    const col = settingFor(a.type);
    const muted = await rest<{ owner: string }[]>(env, `friend_settings?friend=eq.${a.actor}&owner=in.${inList(friends)}&${col}=eq.false&select=owner`);
    const off = new Set(muted.map((m) => m.owner));
    return deliver(env, friends.filter((f) => !off.has(f)), activityMessage(a, await displayName(env, a.actor)), vapid);
  }

  if (input.table === 'visit_companions' && isUuid(input.visit_id) && isUuid(input.user_id)) {
    const c = await claim<{ visit_id: string; user_id: string; created_at: string }>(env, 'visit_companions', `visit_id=eq.${input.visit_id}&user_id=eq.${input.user_id}`);
    if (!c || Date.now() - new Date(c.created_at).getTime() > maxAge) return { skipped: true };
    const visit = (await rest<{ user_id: string; venue_id: string }[]>(env, `visits?id=eq.${c.visit_id}&select=user_id,venue_id`))[0];
    if (!visit) return { skipped: true };
    const venue = (await rest<{ name: string }[]>(env, `venues?id=eq.${visit.venue_id}&select=name`))[0];
    const name = await displayName(env, visit.user_id);
    return deliver(env, [c.user_id], { title: `${name} hat dich markiert`, body: `${venue?.name ?? 'Location'} · Bitte bestätigen oder ablehnen`, url: './#/freunde', tag: `m-${c.visit_id}` }, vapid);
  }

  if (input.table === 'friendships' && isUuid(input.requester) && isUuid(input.addressee)) {
    const f = await claim<{ requester: string; addressee: string; status: string; created_at: string }>(env, 'friendships', `requester=eq.${input.requester}&addressee=eq.${input.addressee}`);
    if (!f || f.status !== 'pending' || Date.now() - new Date(f.created_at).getTime() > maxAge) return { skipped: true };
    const name = await displayName(env, f.requester);
    return deliver(env, [f.addressee], { title: 'Neue Freundschaftsanfrage', body: `${name} möchte sich mit dir vernetzen`, url: './#/freunde', tag: `f-${f.requester}` }, vapid);
  }

  return { skipped: true };
}

/* ------------------------------------------------------------------ */
/* Einstieg in der Supabase-Umgebung                                   */
/* ------------------------------------------------------------------ */

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response>): void } | undefined;

if (typeof Deno !== 'undefined') {
  Deno.serve(async (req: Request) => {
    if (req.method !== 'POST') return new Response('Nur POST', { status: 405 });
    const env = { url: Deno!.env.get('SUPABASE_URL') ?? '', key: Deno!.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' };
    const vapid = {
      publicKey: Deno!.env.get('VAPID_PUBLIC_KEY') ?? '',
      privateKey: Deno!.env.get('VAPID_PRIVATE_KEY') ?? '',
      subject: Deno!.env.get('VAPID_SUBJECT') ?? ''
    };
    if (!env.url || !env.key || !vapid.publicKey || !vapid.privateKey || !vapid.subject) {
      console.error('Secrets fehlen');
      return new Response('Konfiguration unvollständig', { status: 500 });
    }
    try {
      const input = (await req.json()) as Record<string, unknown>;
      const result = await handle(input, env, vapid);
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      console.error(e);
      return new Response('Fehler', { status: 500 });
    }
  });
}
