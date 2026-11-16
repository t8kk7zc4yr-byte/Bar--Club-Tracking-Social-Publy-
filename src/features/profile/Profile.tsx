import { useState } from 'react';
import { Link } from 'react-router-dom';
import { APP } from '../../config/app';
import { Header, RatingLegend, Toggle } from '../../components/ui';
import { authMessage, signOut, updateProfile, useSession } from '../../data/session';
import { useStore } from '../../data/store';
import { getTheme, setTheme } from '../../data/theme';
import { toast } from '../../lib/notify';
import type { ThemeMode } from '../../lib/types';

const THEMES: { key: ThemeMode; label: string }[] = [
  { key: 'system', label: 'Automatisch' },
  { key: 'light', label: 'Hell' },
  { key: 'dark', label: 'Dunkel' }
];

export default function Profile() {
  const profile = useSession((s) => s.profile);
  const email = useSession((s) => s.user?.email ?? '');
  const [name, setName] = useState(profile?.displayName ?? '');
  const [theme, setThemeState] = useState<ThemeMode>(getTheme());
  const pending = useStore((s) => s.pending);

  if (!profile) return null;

  const save = async (patch: Parameters<typeof updateProfile>[0], ok?: string) => {
    try {
      await updateProfile(patch);
      if (ok) toast(ok);
    } catch (e) {
      toast(authMessage(e));
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(profile.friendCode);
      toast('Freundescode kopiert');
    } catch {
      toast(profile.friendCode);
    }
  };

  return (
    <div className="page">
      <Header back title="Profil & Einstellungen" />

      <div className="card">
        <label className="field">
          <span>Anzeigename</span>
          <input
            className="input"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() !== profile.displayName && save({ displayName: name }, 'Name gespeichert')}
          />
        </label>
        <div className="small muted">Angemeldet als {email}</div>
      </div>

      <div className="section">
        <div className="section-h"><h2>👥 Freundescode</h2></div>
        <div className="card flex" style={{ justifyContent: 'space-between' }}>
          <span className="code-box">{profile.friendCode}</span>
          <button className="btn sm" onClick={copyCode}>Kopieren</button>
        </div>
      </div>

      <div className="section">
        <div className="section-h"><h2>🔒 Privatsphäre</h2></div>
        <div className="card" style={{ padding: '2px 14px' }}>
          <div className="switch">
            <div>
              <div className="t">Mit Freunden teilen</div>
              <div className="s">Bestätigte Freunde sehen Check-ins und Bewertungen. Getränke und Ausgaben bleiben immer privat.</div>
            </div>
            <Toggle label="Mit Freunden teilen" checked={profile.shareWithFriends} onChange={(x) => save({ shareWithFriends: x })} />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-h"><h2>🌗 Darstellung</h2></div>
        <div className="seg" role="radiogroup" aria-label="Farbschema">
          {THEMES.map((t) => (
            <button
              key={t.key}
              role="radio"
              aria-checked={theme === t.key}
              className={theme === t.key ? 'on' : ''}
              onClick={() => {
                setTheme(t.key);
                setThemeState(t.key);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-h"><h2>🎨 Bewertungsskala</h2></div>
        <div className="card"><RatingLegend /></div>
      </div>

      <div className="section">
        <div className="section-h"><h2>⚖️ Rechtliches</h2></div>
        <div className="card" style={{ display: 'grid', gap: 8 }}>
          <Link className="btn" to="/datenschutz">Datenschutzhinweise</Link>
          <Link className="btn" to="/impressum">Impressum</Link>
        </div>
      </div>

      <div className="section">
        <div className="card" style={{ display: 'grid', gap: 8 }}>
          <button className="btn" onClick={() => { if (pending === 0 || confirm('Es gibt noch nicht übertragene Änderungen. Beim Abmelden gehen sie verloren. Trotzdem abmelden?')) signOut(); }}>Abmelden</button>
          <div className="small muted">Datenexport und Kontolöschung folgen in einer späteren Version.</div>
        </div>
      </div>

      <div className="section">
        <div className="card small muted" style={{ lineHeight: 1.6 }}>
          <b style={{ color: 'var(--text)' }}>Über {APP.name}</b>
          <br />
          Testversion · Karten: © OpenStreetMap-Mitwirkende.
          <br />
          Trink verantwortungsvoll. Kein Alkohol am Steuer.
        </div>
      </div>
    </div>
  );
}
