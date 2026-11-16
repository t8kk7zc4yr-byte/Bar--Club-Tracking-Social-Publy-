import { Link } from 'react-router-dom';
import { Empty, Header } from '../components/ui';
import { APP } from '../config/app';
import { useSession } from '../data/session';

/** Übergangsseiten, bis die jeweilige Funktion gebaut ist */
export function Home() {
  const name = useSession((s) => s.profile?.displayName ?? '');
  return (
    <div className="page">
      <div className="top">
        <div>
          <div className="sub">Servus {name} 👋</div>
          <h1 className="grad-text" style={{ fontSize: 30 }}>{APP.name}</h1>
        </div>
        <Link className="icon-btn" to="/profil" aria-label="Profil und Einstellungen" style={{ display: 'grid', placeItems: 'center' }}>⚙️</Link>
      </div>
      <Empty emoji="📊" title="Dein Dashboard entsteht hier">
        Sobald Check-ins möglich sind, erscheinen an dieser Stelle Besuche, Vergleiche und Auswertungen.
      </Empty>
    </div>
  );
}

export function Soon({ title, emoji, text, back }: { title: string; emoji: string; text: string; back?: boolean }) {
  return (
    <div className={back ? 'page no-tabbar' : 'page'}>
      <Header title={title} back={back} />
      <Empty emoji={emoji} title="Kommt als Nächstes">{text}</Empty>
    </div>
  );
}
