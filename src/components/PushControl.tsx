import { useEffect, useState } from 'react';
import { disablePush, enablePush, getPushState, type PushState } from '../data/push';
import { toast } from '../lib/notify';
import { Toggle } from './ui';

function usePushState(): [PushState | null, () => void] {
  const [state, setState] = useState<PushState | null>(null);
  const reload = () => void getPushState().then(setState).catch(() => setState('unsupported'));
  useEffect(reload, []);
  return [state, reload];
}

function IOSHint() {
  return (
    <div className="small muted" style={{ lineHeight: 1.55 }}>
      Auf dem iPhone kommen Benachrichtigungen nur in der App auf dem Home-Bildschirm an: In Safari unten auf <b>Teilen</b> tippen,
      dann <b>Zum Home-Bildschirm</b>, die App von dort öffnen, anmelden und hier Push einschalten.
    </div>
  );
}

/** Schalter im Profil */
export function PushSwitch() {
  const [state, reload] = usePushState();
  const [busy, setBusy] = useState(false);
  if (!state) return null;
  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) toast(await enablePush());
      else {
        await disablePush();
        toast('Push auf diesem Gerät ausgeschaltet');
      }
    } catch (e) {
      toast(`Das hat nicht geklappt: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      reload();
    }
  };
  return (
    <>
      <div className="switch">
        <div>
          <div className="t">Push auf diesem Gerät</div>
          <div className="s">
            {state === 'on' && 'Aktiv: Du erfährst, wenn Freunde einchecken, losziehen, dich markieren oder anfragen.'}
            {state === 'off' && 'Wenn Freunde einchecken, losziehen, dich markieren oder anfragen.'}
            {state === 'denied' && 'Blockiert. Erlauben kannst du es nur in den Einstellungen des Geräts.'}
            {state === 'unsupported' && 'In diesem Browser nicht verfügbar (oder Entwicklungsmodus).'}
            {state === 'ios-homescreen' && 'Nur in der App auf dem Home-Bildschirm möglich.'}
          </div>
        </div>
        <Toggle label="Push auf diesem Gerät" checked={state === 'on'} onChange={(x) => !busy && (state === 'on' || state === 'off') && toggle(x)} />
      </div>
      {state === 'ios-homescreen' && <div style={{ paddingBottom: 12 }}><IOSHint /></div>}
    </>
  );
}

/** Hinweis auf der Freunde-Seite, solange Push aus ist */
export function PushBanner() {
  const [state, reload] = usePushState();
  const [busy, setBusy] = useState(false);
  if (state !== 'off' && state !== 'ios-homescreen') return null;
  return (
    <div className="card mt12">
      <div className="flex between" style={{ gap: 12 }}>
        <div className="small">🔔 Push erlauben, um zu erfahren, wenn Freunde etwas eintragen oder losziehen.</div>
        {state === 'off' && (
          <button
            className="btn sm primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                toast(await enablePush());
              } finally {
                setBusy(false);
                reload();
              }
            }}
          >
            Erlauben
          </button>
        )}
      </div>
      {state === 'ios-homescreen' && <div className="mt8"><IOSHint /></div>}
    </div>
  );
}
