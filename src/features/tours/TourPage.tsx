import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline } from 'react-leaflet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FitBounds, Tiles, venueIcon } from '../../components/MapBits';
import { Avatar, Empty, Header, RatingBadge } from '../../components/ui';
import { useSession } from '../../data/session';
import { fetchTourStops, leaveTour, useSocial, type TourStop } from '../../data/social';
import { useStore } from '../../data/store';
import { toast } from '../../lib/notify';
import { categoryInfo } from '../../lib/tags';
import type { Venue } from '../../lib/types';

const time = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/** Eine Kneipentour: Stationen aller Teilnehmer in zeitlicher Reihenfolge mit Route auf der Karte */
export default function TourPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const uid = useSession((s) => s.user?.id);
  const myName = useSession((s) => s.profile?.displayName ?? 'Ich');
  const localTour = useStore((s) => s.tours.find((t) => t.id === id));
  const visits = useStore((s) => s.visits);
  const localVenues = useStore((s) => s.venues);
  const remoteTour = useSocial((s) => s.tours.find((t) => t.id === id));
  const friends = useSocial((s) => s.friends);
  const [remote, setRemote] = useState<{ stops: TourStop[]; venues: Record<string, Venue> } | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchTourStops(id).then(setRemote).catch(() => setOffline(true));
  }, [id, visits]);

  // Ohne Verbindung: nur die eigenen Stationen aus dem Gerät
  const { stops, venues } = useMemo(() => {
    if (remote?.stops.length) return remote;
    const own = visits
      .filter((v) => v.tourId === id)
      .sort((a, b) => a.visitedAt.localeCompare(b.visitedAt))
      .map((v) => ({ visitId: v.id, userId: uid ?? '', name: myName, venueId: v.venueId, visitedAt: v.visitedAt, rating: v.rating ?? null }));
    return { stops: own, venues: Object.fromEntries(localVenues.map((v) => [v.id, v])) };
  }, [remote, visits, id, uid, myName, localVenues]);

  const tour = localTour ?? (remoteTour ? { id: remoteTour.id, ownerId: remoteTour.ownerId, name: remoteTour.name, day: remoteTour.day } : null);
  if (!tour) {
    return (
      <div className="page no-tabbar">
        <Header back title="Tour" />
        <Empty emoji="🚶" title="Tour nicht gefunden">Vielleicht hat der Freund das Teilen beendet.</Empty>
      </div>
    );
  }

  const isOwner = tour.ownerId === uid;
  const people = [...new Set(stops.map((s) => s.userId))];
  const color = (userId: string) => (userId === uid ? 'var(--accent)' : friends.find((f) => f.id === userId)?.avatarColor ?? '#888888');
  const points = stops
    .map((s) => venues[s.venueId])
    .filter((v): v is Venue => !!v && v.lat !== null && v.lat !== undefined && v.lng !== null && v.lng !== undefined)
    .map((v) => [v.lat!, v.lng!] as [number, number]);
  // Route der Gruppe: aufeinanderfolgende gleiche Orte zusammenfassen
  const route = points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]);
  const stations = new Set(stops.map((s) => s.venueId)).size;

  return (
    <div className="page no-tabbar">
      <Header
        back
        title={tour.name}
        sub={`${stations} ${stations === 1 ? 'Station' : 'Stationen'} · ${people.length} ${people.length === 1 ? 'Person' : 'Personen'}${isOwner ? '' : ` · gestartet von ${remoteTour?.ownerName ?? 'einem Freund'}`}`}
      />
      {offline && <div className="sync-note" style={{ marginBottom: 10 }}>Offline: Es werden nur deine eigenen Stationen angezeigt.</div>}

      {route.length > 0 && (
        <div className="mini-map" style={{ height: 260 }}>
          <MapContainer center={route[0]} zoom={15} zoomControl={false}>
            <Tiles />
            <FitBounds points={route} padding={30} />
            {route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#ff4fa3', weight: 4, dashArray: '6 8' }} />}
            {[...new Set(stops.map((s) => s.venueId))].map((vid) => {
              const v = venues[vid];
              if (!v || v.lat === null || v.lat === undefined) return null;
              const best = Math.max(...stops.filter((s) => s.venueId === vid).map((s) => s.rating ?? 0));
              return <Marker key={vid} position={[v.lat, v.lng!]} icon={venueIcon({ rating: best || null, wishlist: false, favorite: false })} />;
            })}
          </MapContainer>
        </div>
      )}

      <div className="section">
        <div className="section-h"><h2>🕒 Verlauf</h2></div>
        <div className="card timeline" style={{ padding: '0 14px' }}>
          {stops.map((s, i) => {
            const v = venues[s.venueId];
            const mine = s.userId === uid;
            const body = (
              <>
                <div className="date"><div className="d" style={{ fontSize: 15 }}>{time(s.visitedAt)}</div><div className="m">#{i + 1}</div></div>
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{v ? `${categoryInfo(v.category).emoji} ${v.name}` : 'Location'}</div>
                  <div className="small muted flex" style={{ gap: 6 }}>
                    <Avatar name={s.name} color={color(s.userId)} size="sm" /> {mine ? 'Du' : s.name}
                  </div>
                </div>
                {s.rating !== null && <RatingBadge value={s.rating} size="sm" />}
              </>
            );
            return mine ? (
              <Link className="item" key={s.visitId} to={`/besuch/${s.visitId}`}>{body}</Link>
            ) : (
              <div className="item" key={s.visitId}>{body}</div>
            );
          })}
          {!stops.length && <div className="small muted" style={{ padding: 12 }}>Noch keine Stationen.</div>}
        </div>
      </div>

      <div className="section">
        <button className="btn primary block" onClick={() => nav('/checkin')}>🍻 Nächste Station einchecken</button>
        {!isOwner && (
          <button
            className="btn block mt8"
            onClick={async () => {
              if (!confirm('Tour verlassen? Deine Besuche bleiben erhalten.')) return;
              try {
                await leaveTour(tour);
                toast('Tour verlassen');
                nav(-1);
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            Tour verlassen
          </button>
        )}
        <p className="small muted mt8">
          {isOwner
            ? 'Weitere Check-ins an diesem Abend landen automatisch in dieser Tour. Freunde, mit denen du teilst, können beitreten.'
            : 'Deine Check-ins an diesem Abend landen automatisch in dieser Tour.'}
        </p>
      </div>
    </div>
  );
}
