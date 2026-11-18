import { createECDH, createPublicKey, verify, randomBytes } from 'node:crypto';
import ece from 'http_ece';
import { describe, expect, it } from 'vitest';
import { activityMessage, b64urlDecode, b64urlEncode, encryptPayload, settingFor, vapidHeader, type ActivityRow } from '../supabase/functions/notify/index';

/** Ein „Gerät“ wie im Browser: Schlüsselpaar und Authentifizierungsgeheimnis */
function fakeDevice() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = randomBytes(16);
  return { ecdh, auth, sub: { endpoint: 'https://push.example.org/abc', p256dh: b64urlEncode(ecdh.getPublicKey()), auth: b64urlEncode(auth) } };
}

describe('Verschlüsselung der Push-Nachricht (RFC 8291)', () => {
  it('lässt sich mit http_ece (wie in web-push) entschlüsseln', async () => {
    const dev = fakeDevice();
    const msg = JSON.stringify({ title: 'Anna ist eingecheckt 🍻', body: 'Zum Zapfhahn · Köln · 8/10', url: './#/freunde' });
    const body = await encryptPayload(dev.sub, new TextEncoder().encode(msg));
    const plain = ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: dev.ecdh, authSecret: dev.auth });
    expect(plain.toString('utf8')).toBe(msg);
  });

  it('erzeugt für jede Nachricht einen neuen Kopf (Salz und Absenderschlüssel)', async () => {
    const dev = fakeDevice();
    const a = await encryptPayload(dev.sub, new TextEncoder().encode('x'));
    const b = await encryptPayload(dev.sub, new TextEncoder().encode('x'));
    expect(Buffer.from(a.slice(0, 16)).equals(Buffer.from(b.slice(0, 16)))).toBe(false);
    expect(a[20]).toBe(65);
    expect(new DataView(a.buffer, a.byteOffset).getUint32(16)).toBe(4096);
  });

  it('scheitert beim Entschlüsseln mit falschem Geheimnis', async () => {
    const dev = fakeDevice();
    const body = await encryptPayload(dev.sub, new TextEncoder().encode('geheim'));
    expect(() => ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: dev.ecdh, authSecret: randomBytes(16) })).toThrow();
  });
});

describe('Absenderkennung (VAPID)', () => {
  it('ist gültig signiert und enthält Empfänger, Ablauf und Kontakt', async () => {
    const server = createECDH('prime256v1');
    server.generateKeys();
    const pub = b64urlEncode(server.getPublicKey());
    const priv = b64urlEncode(server.getPrivateKey());
    const now = Date.UTC(2026, 10, 18, 12);
    const h = await vapidHeader('https://web.push.apple.com/QGuQyavXutnMH', pub, priv, 'https://example.org/app/', now);
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(h);
    expect(m).not.toBeNull();
    const [, head, claims, sig, k] = m!;
    expect(k).toBe(pub);
    expect(JSON.parse(Buffer.from(head, 'base64url').toString())).toEqual({ typ: 'JWT', alg: 'ES256' });
    const c = JSON.parse(Buffer.from(claims, 'base64url').toString());
    expect(c.aud).toBe('https://web.push.apple.com');
    expect(c.sub).toBe('https://example.org/app/');
    expect(c.exp).toBe(now / 1000 + 12 * 3600);
    const raw = b64urlDecode(pub);
    const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64urlEncode(raw.slice(1, 33)), y: b64urlEncode(raw.slice(33)) }, format: 'jwk' });
    const ok = verify('sha256', Buffer.from(`${head}.${claims}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'));
    expect(ok).toBe(true);
  });
});

describe('Texte und Einstellungen', () => {
  const base: ActivityRow = { id: '1', actor: 'a', type: 'checkin', venue_name: 'Zum Zapfhahn', city: 'Köln', rating: 8, tour_id: null, created_at: '' };
  it('formuliert Check-ins mit Ort und Bewertung', () => {
    expect(activityMessage(base, 'Anna')).toMatchObject({ title: 'Anna ist eingecheckt 🍻', body: 'Zum Zapfhahn · Köln · 8/10' });
  });
  it('verlinkt Touren auf die Tour-Seite', () => {
    expect(activityMessage({ ...base, type: 'tour', tour_id: 't1', venue_name: 'Tour am Sa' }, 'Anna').url).toBe('./#/tour/t1');
  });
  it('nutzt für „unterwegs“ die eigene Einstellung', () => {
    expect(settingFor('going_out')).toBe('notify_going_out');
    expect(settingFor('photo')).toBe('notify_entries');
  });
});
