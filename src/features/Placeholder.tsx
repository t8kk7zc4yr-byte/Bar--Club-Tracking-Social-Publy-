import { Link } from 'react-router-dom';
import { Empty, Header, RatingBadge } from '../components/ui';
import { APP } from '../config/app';
import { useSession } from '../data/session';
import { useStore } from '../data/store';
import { categoryInfo } from '../lib/tags';
import { fmtDate } from '../lib/util';

/** Übergangs-Startseite, bis das Dashboard gebaut ist: zeigt die letzten Besuche */
export function Home() {
  const name = useSession((s) => s.profile?.displayName ?? '');
  const visits = useStore((s) => s.visits);
  const venues = useStore((s) => s.venues);
  const pending = useStore((s) => s.pending);
  const online = typeof navigator === 'undefined' || navigator.onLine;
  const recent = [...visits].sort((a, b) => b.visitedAt.localeCompare(a.visitedAt)).slice(0, 15);

  return (
    <div className="page">
      <div className="top">
        <div>
          <div className="sub">Servus {name} 👋</div>
          <h1 className="grad-text" style={{ fontSize: 30 }}>{APP.name}</h1>
        </div>
        <Link className="icon-btn" to="/profil" aria-label="Profil und Einstellungen" style={{ display: 'grid', placeItems: 'center' }}>⚙️</Link>
      </div>

      {pending > 0 && (
        <div className="sync-note" role="status">
          {online ? `${pending} Änderung(en) werden übertragen …` : `Offline: ${pending} Änderung(en) werden gesendet, sobald wieder Netz da ist.`}
        </div>
      )}

      {recent.length === 0 ? (
        <Empty emoji="🍻" title="Noch keine Besuche">
          Tippe unten auf das Plus, um deinen ersten Check-in anzulegen.
        </Empty>
      ) : (
        <div className="section">
          <div className="section-h"><h2>🕒 Letzte Besuche</h2></div>
          {recent.map((v) => {
            const venue = venues.find((x) => x.id === v.venueId);
            return (
              <Link key={v.id} to={`/besuch/${v.id}`} className="vrow">
                <span className="thumb" style={{ display: 'grid', placeItems: 'center', fontSize: 24 }}>{categoryInfo(venue?.category ?? '').emoji}</span>
                <div className="main">
                  <div className="name">{venue?.name ?? 'Unbekannte Location'}</div>
                  <div className="meta">{[venue?.city, fmtDate(v.visitedAt, true)].filter(Boolean).join(' · ')}</div>
                </div>
                <RatingBadge value={v.rating} size="sm" />
              </Link>
            );
          })}
        </div>
      )}
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
