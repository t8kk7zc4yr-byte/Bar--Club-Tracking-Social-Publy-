import { useState } from 'react';
import { Link } from 'react-router-dom';
import { APP } from '../../config/app';
import { Header, RatingLegend, Toggle } from '../../components/ui';
import DeleteDialog from '../../components/DeleteDialog';
import { exportMyData } from '../../data/account';
import { authMessage, signOut, updateBudget, updateProfile, useSession } from '../../data/session';
import { useStore } from '../../data/store';
import { getTheme, setTheme } from '../../data/theme';
import { toast } from '../../lib/notify';
import type { ThemeMode } from '../../lib/types';
import { euro } from '../../lib/util';

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
  const visits = useStore((s) => s.visits);
  const [budget, setBudget] = useState(profile?.monthlySpendLimit ? String(profile.monthlySpendLimit).replace('.', ',') : '');
  const [deleting, setDeleting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  if (!profile) return null;

  const save = async (patch: Parameters<typeof updateProfile>[0], ok?: string) => {
    try {
      await updateProfile(patch);
      if (ok) toast(ok);
    } catch (e) {
      toast(authMessage(e));
    }
  };

  const now = new Date();
  const monthSpend = visits
    .filter((v) => {
      const d = new Date(v.visitedAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((a, v) => a + (v.spend ?? 0), 0);
  const limit = profile.monthlySpendLimit ?? null;

  const saveBudget = async () => {
    const n = budget.trim() ? parseFloat(budget.replace(',', '.')) : NaN;
    const next = Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
    if (next === limit) return;
    try {
      await updateBudget(next);
      toast(next ? 'Budget gespeichert' : 'Budget entfernt');
    } catch (e) {
      toast(authMessage(e));
    }
  };

  const doExport = async () => {
    try {
      await exportMyData(setExportMsg);
      toast('Export erstellt');
    } catch (e) {
      toast(`Export fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setExportMsg(null);
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
        <div className="section-h"><h2>💶 Budget</h2></div>
        <div className="card">
          <label className="field" style={{ marginBottom: 6 }}>
            <span>Monatliches Ausgehbudget (€, optional)</span>
            <input className="input" inputMode="decimal" placeholder="z. B. 150" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9.,]/g, ''))} onBlur={saveBudget} />
          </label>
          {limit ? (
            <>
              <div className="small muted">{euro(monthSpend)} von {euro(limit)} in diesem Monat</div>
              <div className="bar" style={{ height: 8 }}>
                <i style={{ width: `${Math.min(100, (monthSpend / limit) * 100)}%`, background: monthSpend > limit ? 'var(--bad)' : undefined }} />
              </div>
            </>
          ) : (
            <div className="small muted">Hilft, die Ausgaben im Blick zu behalten. Nur für dich sichtbar.</div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-h"><h2>💾 Deine Daten</h2></div>
        <div className="card" style={{ display: 'grid', gap: 8 }}>
          <button className="btn" disabled={!!exportMsg} onClick={doExport}>{exportMsg ?? '⬇️ Alle Daten exportieren (JSON, mit Fotos)'}</button>
          <button className="btn danger" onClick={() => setDeleting(true)}>🗑️ Konto und alle Daten löschen …</button>
          <div className="small muted">Der Export enthält alles, was zu deinem Konto gespeichert ist. Die Löschung entfernt dein Konto unwiderruflich.</div>
        </div>
      </div>

      <div className="section">
        <div className="card" style={{ display: 'grid', gap: 8 }}>
          <button className="btn" onClick={() => { if (pending === 0 || confirm('Es gibt noch nicht übertragene Änderungen. Beim Abmelden gehen sie verloren. Trotzdem abmelden?')) signOut(); }}>Abmelden</button>
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
      {deleting && <DeleteDialog onClose={() => setDeleting(false)} onExport={doExport} />}
    </div>
  );
}
