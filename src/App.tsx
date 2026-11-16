import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import TabBar from './components/TabBar';
import { Toasts } from './components/ui';
import { APP } from './config/app';
import { useSession } from './data/session';
import { isConfigured } from './data/supabase';
import AuthPage from './features/auth/AuthPage';
import NewPassword from './features/auth/NewPassword';
import Legal from './features/legal/Legal';
import { Home, Soon } from './features/Placeholder';
import Profile from './features/profile/Profile';

export default function App() {
  const status = useSession((s) => s.status);
  const hasProfile = useSession((s) => !!s.profile);
  const loc = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  if (!isConfigured) {
    return (
      <div className="app">
        <div className="gate">
          <h1 className="grad-text">{APP.name}</h1>
          <p className="muted">Die Verbindung zum Server ist nicht eingerichtet (.env.local fehlt).</p>
        </div>
      </div>
    );
  }

  // Rechtstexte müssen immer erreichbar sein, auch ohne Anmeldung
  const legal = loc.pathname === '/datenschutz' ? 'datenschutz' : loc.pathname === '/impressum' ? 'impressum' : null;
  if (legal) {
    return (
      <div className="app">
        <Legal doc={legal} />
      </div>
    );
  }

  if (status === 'loading') return <div className="app"><div className="page muted center">Lädt …</div></div>;
  if (status === 'recovery') return <><Toasts /><NewPassword /></>;
  if (status === 'out') return <AuthPage />;
  if (!hasProfile) {
    return (
      <div className="app">
        <div className="gate">
          <p className="muted">Dein Profil konnte nicht geladen werden. Bitte prüfe die Internetverbindung und lade die Seite neu.</p>
        </div>
      </div>
    );
  }

  const hideTabs = /^\/(checkin|profil)/.test(loc.pathname);

  return (
    <div className="app">
      <Toasts />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/karte" element={<Soon title="Karte" emoji="🗺️" text="Alle besuchten Locations als farbige Pins." />} />
        <Route path="/liste" element={<Soon title="Ranking" emoji="🏆" text="Deine Locations, sortiert nach Bewertung." />} />
        <Route path="/freunde" element={<Soon title="Freunde" emoji="👥" text="Feed, Freundescode und „Bin unterwegs“." />} />
        <Route path="/checkin" element={<Soon back title="Check-in" emoji="📍" text="Location wählen, bewerten, Foto hinzufügen." />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!hideTabs && <TabBar />}
    </div>
  );
}
