import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { APP } from '../../config/app';
import { isAdult } from '../../lib/age';
import {
  authMessage, checkInvite, clearNotice, MIN_PASSWORD, sendPasswordReset, signIn, signUp, useSession
} from '../../data/session';

type Mode = 'login' | 'register' | 'reset' | 'sent' | 'reset-sent';

export default function AuthPage() {
  const notice = useSession((s) => s.notice);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [invite, setInvite] = useState('');
  const [privacy, setPrivacy] = useState(false);
  const [share, setShare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = (m: Mode) => {
    setError(null);
    clearNotice();
    setMode(m);
  };

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onLogin = (e: FormEvent) => {
    e.preventDefault();
    run(() => signIn(email, password));
  };

  const onRegister = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (!name.trim()) throw new Error('Bitte gib einen Namen an.');
      if (!birth) throw new Error('Bitte gib dein Geburtsdatum an.');
      if (!isAdult(birth, APP.minAge)) {
        throw new Error(`${APP.name} ist erst ab ${APP.minAge} Jahren nutzbar. Eine Registrierung ist deshalb nicht möglich.`);
      }
      if (password.length < MIN_PASSWORD) throw new Error(`Das Passwort braucht mindestens ${MIN_PASSWORD} Zeichen.`);
      if (!privacy) throw new Error('Bitte bestätige die Datenschutzhinweise.');
      if (!(await checkInvite(invite))) throw new Error('Der Einladungscode ist ungültig oder aufgebraucht.');
      const result = await signUp({ email, password, displayName: name, inviteCode: invite, shareWithFriends: share });
      if (result === 'confirm') setMode('sent');
    });
  };

  const onReset = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await sendPasswordReset(email);
      setMode('reset-sent');
    });
  };

  return (
    <div className="app">
      <div className="gate">
        <div className="logo">🍸</div>
        <h1 style={{ fontSize: 34, margin: '8px 0 4px' }}>
          <span className="grad-text">{APP.name}</span>
        </h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Dein Tagebuch für Bars und Clubs. Bewerte Locations, halte deine Abende fest und sieh, wo deine Freunde unterwegs sind.
        </p>

        {notice && <div className="notice" role="status">{notice}</div>}
        {error && <div className="warnbox" role="alert">{error}</div>}

        {mode === 'login' && (
          <form onSubmit={onLogin}>
            <label className="field">
              <span>E-Mail</span>
              <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              <span>Passwort</span>
              <input className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <button className="btn primary block" disabled={busy}>Anmelden</button>
            <div className="mt16 center small">
              <button type="button" className="link-btn" onClick={() => go('reset')}>Passwort vergessen?</button>
            </div>
            <button type="button" className="btn block mt16" onClick={() => go('register')}>Neues Konto erstellen</button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={onRegister}>
            <label className="field">
              <span>Einladungscode</span>
              <input className="input" required autoCapitalize="characters" autoComplete="off" value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase())} />
            </label>
            <label className="field">
              <span>Wie heißt du? (für Freunde sichtbar)</span>
              <input className="input" required maxLength={40} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span>Geburtsdatum (wird nur geprüft, nicht gespeichert)</span>
              <input className="input" type="date" required max={new Date().toISOString().slice(0, 10)} value={birth} onChange={(e) => setBirth(e.target.value)} />
            </label>
            <label className="field">
              <span>E-Mail</span>
              <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              <span>Passwort (mindestens {MIN_PASSWORD} Zeichen)</span>
              <input className="input" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>

            <label className="card check">
              <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
              <span>
                Ich habe die <a href="#/datenschutz" target="_blank" rel="noopener">Datenschutzhinweise</a> gelesen. <span className="muted small">Erforderlich.</span>
              </span>
            </label>
            <label className="card check">
              <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
              <span>
                Check-ins, Bewertungen und „Bin unterwegs“ mit <b>bestätigten Freunden teilen</b>.{' '}
                <span className="muted small">Freiwillig. Ohne Haken bleibt alles privat; jederzeit im Profil änderbar.</span>
              </span>
            </label>

            <button className="btn primary block mt16" disabled={busy}>Konto erstellen</button>
            <button type="button" className="btn block mt12" onClick={() => go('login')}>Ich habe schon ein Konto</button>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={onReset}>
            <p className="muted small" style={{ textAlign: 'left' }}>
              Gib deine E-Mail-Adresse ein. Du erhältst einen Link, über den du ein neues Passwort vergeben kannst.
            </p>
            <label className="field">
              <span>E-Mail</span>
              <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="btn primary block" disabled={busy}>Link senden</button>
            <button type="button" className="btn block mt12" onClick={() => go('login')}>Zurück zur Anmeldung</button>
          </form>
        )}

        {mode === 'sent' && (
          <div className="mt16">
            <div className="notice">
              <b>Fast geschafft.</b> Wir haben eine Mail an {email} geschickt. Öffne den Link darin, um deine Adresse zu bestätigen, und melde dich danach hier an.
              Schau auch im Spam-Ordner nach.
            </div>
            <button className="btn primary block" onClick={() => go('login')}>Zur Anmeldung</button>
          </div>
        )}

        {mode === 'reset-sent' && (
          <div className="mt16">
            <div className="notice">Falls zu {email} ein Konto besteht, ist eine Mail mit einem Link zum Zurücksetzen unterwegs.</div>
            <button className="btn primary block" onClick={() => go('login')}>Zur Anmeldung</button>
          </div>
        )}

        <p className="small muted mt16">
          Nur für Erwachsene. Trink verantwortungsvoll, kein Alkohol am Steuer.
          <br />
          <Link to="/datenschutz">Datenschutz</Link> · <Link to="/impressum">Impressum</Link>
        </p>
      </div>
    </div>
  );
}
