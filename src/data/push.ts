import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushState =
  /** Browser kann kein Web Push (oder Entwicklungsmodus ohne Service Worker) */
  | 'unsupported'
  /** iPhone/iPad: Push nur aus der App auf dem Home-Bildschirm */
  | 'ios-homescreen'
  /** Erlaubnis wurde verweigert; nur in den Systemeinstellungen änderbar */
  | 'denied'
  | 'off'
  | 'on';

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID_PUBLIC_KEY;

function keyBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Service Worker der installierten App (im Entwicklungsmodus gibt es keinen) */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return navigator.serviceWorker.ready;
}

export async function getPushState(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return 'ios-homescreen';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registration();
  if (!reg) return 'unsupported';
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

async function save(sub: PushSubscription): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    { owner: data.user.id, endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    { onConflict: 'endpoint' }
  );
  return !error;
}

/** Fragt die Erlaubnis an (nur nach Antippen aufrufen) und speichert das Abo. Rückgabe: Hinweistext */
export async function enablePush(): Promise<string> {
  const state = await getPushState();
  if (state === 'ios-homescreen') return 'Auf dem iPhone funktioniert Push nur aus der App auf dem Home-Bildschirm.';
  if (state === 'unsupported') return 'Dieser Browser unterstützt keine Push-Benachrichtigungen.';
  if (state === 'denied') return 'Benachrichtigungen sind blockiert. Bitte in den Einstellungen des Geräts erlauben.';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'Benachrichtigungen wurden nicht erlaubt.';
  const reg = (await registration())!;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY!) as BufferSource });
  if (!(await save(sub))) {
    // Das Abo gehörte zu einem anderen Konto auf diesem Gerät: neu anlegen
    await sub.unsubscribe();
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY!) as BufferSource });
    if (!(await save(sub))) return 'Das Abo konnte nicht gespeichert werden. Bitte später erneut versuchen.';
  }
  return '🔔 Push-Benachrichtigungen sind auf diesem Gerät aktiv';
}

/** Beendet Push auf diesem Gerät und entfernt das Abo vom Server */
export async function disablePush(): Promise<void> {
  if (!supported()) return;
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe().catch(() => {});
}

/** Nach dem Start: ein bestehendes Abo erneut speichern (z. B. nach Schlüsselwechsel des Browsers) */
export async function refreshPushSubscription(): Promise<void> {
  try {
    if ((await getPushState()) !== 'on') return;
    const sub = await (await registration())?.pushManager.getSubscription();
    if (sub) await save(sub);
  } catch {
    /* ohne Netz später erneut */
  }
}
