import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import TabBar from './components/TabBar';
import { Toasts } from './components/ui';
import { APP } from './config/app';
import { useSession } from './data/session';
import { initStore, resetStore, useStore } from './data/store';
import { startSync, sync } from './data/sync';
import { isConfigured } from './data/supabase';
import AuthPage from './features/auth/AuthPage';
import NewPassword from './features/auth/NewPassword';
import Legal from './features/legal/Legal';
import Friends from './features/friends/Friends';
import { refreshSocial, resetSocial } from './data/social';
import Dashboard from './features/dashboard/Dashboard';
import Profile from './features/profile/Profile';
import CheckIn from './features/checkin/CheckIn';
import VenueForm from './features/venue/VenueForm';
import VenueDetail from './features/venue/VenueDetail';
import MapPage from './features/map/MapPage';
import ListPage from './features/ranking/ListPage';

export default function App() {
  const status = useSession((s) => s.status);
  const hasProfile = useSession((s) => !!s.profile);
  const userId = useSession((s) => s.user?.id ?? null);
  const storeReady = useStore((s) => s.loaded);
  const loc = useLocation();

  // Lokale Daten des angemeldeten Kontos laden und mit dem Server abgleichen; bei Abmeldung entfernen
  useEffect(() => {
    if (status === 'in' && userId) {
      startSync();
      initStore(userId).then(() => sync(true));
      void refreshSocial();
      // Feed und Anfragen im Hintergrund aktuell halten, solange die App sichtbar ist
      const t = window.setInterval(() => document.visibilityState === 'visible' && void refreshSocial(), 120000);
      const onVisible = () => document.visibilityState === 'visible' && void refreshSocial();
      document.addEventListener('visibilitychange', onVisible);
      return () => {
        clearInterval(t);
        document.removeEventListener('visibilitychange', onVisible);
      };
    }
    if (status === 'out') {
      void resetStore();
      resetSocial();
    }
  }, [status, userId]);

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

  if (!storeReady) return <div className="app"><div className="page muted center">Lädt …</div></div>;

  const hideTabs = /^\/(checkin|profil|besuch\/|location\/neu)/.test(loc.pathname);

  return (
    <div className="app">
      <Toasts />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/karte" element={<MapPage />} />
        <Route path="/liste" element={<ListPage />} />
        <Route path="/location/:id" element={<VenueDetail />} />
        <Route path="/freunde" element={<Friends />} />
        <Route path="/checkin" element={<CheckIn />} />
        <Route path="/besuch/:visitId" element={<CheckIn />} />
        <Route path="/location/neu" element={<VenueForm />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!hideTabs && <TabBar />}
    </div>
  );
}
