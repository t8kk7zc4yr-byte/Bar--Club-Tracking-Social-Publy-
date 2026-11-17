import { NavLink, useNavigate } from 'react-router-dom';
import { unreadCount, useSocial } from '../data/social';

const TABS = [
  { to: '/', icon: '🏠', label: 'Home', end: true },
  { to: '/karte', icon: '🗺️', label: 'Karte' },
  null,
  { to: '/liste', icon: '🏆', label: 'Ranking' },
  { to: '/freunde', icon: '👥', label: 'Freunde' }
] as const;

export default function TabBar() {
  const nav = useNavigate();
  const unread = useSocial(unreadCount);
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      {TABS.map((t) =>
        t ? (
          <NavLink key={t.to} to={t.to} end={'end' in t ? t.end : false}>
            <span className="i">{t.icon}</span>
            {t.label}
            {t.to === '/freunde' && unread > 0 && <span className="dot" aria-label={`${unread} neu`}>{unread}</span>}
          </NavLink>
        ) : (
          <div className="fab-slot" key="fab">
            <button className="fab" aria-label="Check-in" onClick={() => nav('/checkin')}>
              +
            </button>
          </div>
        )
      )}
    </nav>
  );
}
