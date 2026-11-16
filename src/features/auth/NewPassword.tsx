import { useState, type FormEvent } from 'react';
import { APP } from '../../config/app';
import { authMessage, MIN_PASSWORD, setNewPassword } from '../../data/session';
import { toast } from '../../lib/notify';

/** Erscheint nach dem Klick auf den Link aus der Passwort-Mail */
export default function NewPassword() {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(`Das Passwort braucht mindestens ${MIN_PASSWORD} Zeichen.`);
    if (password !== repeat) return setError('Die beiden Eingaben stimmen nicht überein.');
    setBusy(true);
    try {
      await setNewPassword(password);
      toast('Passwort geändert');
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <div className="gate">
        <h1 style={{ fontSize: 28 }}>
          <span className="grad-text">{APP.name}</span>
        </h1>
        <p className="muted">Vergib ein neues Passwort für dein Konto.</p>
        {error && <div className="warnbox" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <label className="field">
            <span>Neues Passwort</span>
            <input className="input" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="field">
            <span>Wiederholen</span>
            <input className="input" type="password" required autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </label>
          <button className="btn primary block" disabled={busy}>Passwort speichern</button>
        </form>
      </div>
    </div>
  );
}
