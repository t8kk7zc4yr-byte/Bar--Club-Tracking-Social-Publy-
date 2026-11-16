import { APP } from './config/app';
import { isConfigured } from './data/supabase';

/** Platzhalter aus Phase 0; wird in Phase 1 durch Anmeldung, Routing und Tab-Leiste ersetzt. */
export default function App() {
  return (
    <div className="app">
      <div className="page">
        <h1 className="grad-text">{APP.name}</h1>
        <p className="muted">
          {isConfigured
            ? 'Grundgerüst steht. Als Nächstes folgen Anmeldung und Check-in.'
            : 'Supabase ist noch nicht verbunden: .env.local nach dem Muster von .env.example anlegen.'}
        </p>
      </div>
    </div>
  );
}
