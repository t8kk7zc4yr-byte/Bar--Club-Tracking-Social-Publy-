import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type L from 'leaflet';
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { BoundsWatcher, catalogIcon, clusterIcon, FitBounds, FlyTo, meIcon, Tiles, useFit, venueIcon, ZoomWatcher } from '../../components/MapBits';
import { RatingBadge, TagList, TagPicker } from '../../components/ui';
import { catalogInBox } from '../../data/osm';
import { adoptVenue, myVenues, toView, useStore, type VenueView } from '../../data/store';
import { toast } from '../../lib/notify';
import { CATEGORIES, categoryInfo, SPORT_TAGS, type CategoryId, type TagId } from '../../lib/tags';
import { getPosition } from '../../lib/util';
import { venueStats } from '../../lib/venueStats';

type Filter = 'all' | 'fav' | 'wish' | 'sport' | CategoryId;
type Located = VenueView & { lat: number; lng: number };

/** Ab dieser Zoomstufe zeigt die Karte alle Bars und Clubs im Ausschnitt */
const CATALOG_ZOOM = 12;

/** Einfaches Pixel-Clustering: Locations, die beim aktuellen Zoom weniger als 56 px auseinander liegen, werden zusammengefasst */
function Clusters({ venues, zoom, renderPin }: { venues: Located[]; zoom: number; renderPin: (v: Located) => ReactNode }) {
  const map = useMap();
  const fit = useFit();
  const clusters = useMemo(() => {
    const out: { pts: Located[]; x: number; y: number }[] = [];
    for (const v of venues) {
      const p = map.project([v.lat, v.lng], zoom);
      const hit = out.find((c) => Math.hypot(c.x - p.x, c.y - p.y) < 56);
      if (hit) {
        hit.pts.push(v);
        hit.x = (hit.x * (hit.pts.length - 1) + p.x) / hit.pts.length;
        hit.y = (hit.y * (hit.pts.length - 1) + p.y) / hit.pts.length;
      } else out.push({ pts: [v], x: p.x, y: p.y });
    }
    return out;
  }, [venues, zoom, map]);
  return (
    <>
      {clusters.map((c) => {
        if (c.pts.length === 1 || zoom >= 17) return c.pts.map(renderPin);
        const rated = c.pts.filter((v) => v.rating !== null);
        const avg = rated.length ? rated.reduce((a, v) => a + v.rating!, 0) / rated.length : null;
        return (
          <Marker
            key={c.pts.map((v) => v.id).join()}
            position={map.unproject([c.x, c.y], zoom)}
            icon={clusterIcon(c.pts.length, avg)}
            title={`${c.pts.length} Locations`}
            eventHandlers={{ click: () => fit(c.pts.map((v) => [v.lat, v.lng])) }}
          />
        );
      })}
    </>
  );
}

export default function MapPage() {
  const venues = useStore(myVenues);
  const visits = useStore((s) => s.visits);
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [tags, setTags] = useState<TagId[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [me, setMe] = useState<[number, number] | null>(null);
  const [zoom, setZoom] = useState(6);
  const stats = useMemo(() => venueStats(venues, visits), [venues, visits]);
  const [showAll, setShowAll] = useState(true);
  const [view, setView] = useState<{ bounds: L.LatLngBounds; zoom: number } | null>(null);
  const [catalog, setCatalog] = useState<Located[]>([]);
  const [capped, setCapped] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  // Katalog nur bei allgemeinen Filtern zeigen; Favoriten, Wunschliste, Sport und Tags sind persönliche Angaben
  const catalogFilterOk = !tags.length && filter !== 'fav' && filter !== 'wish' && filter !== 'sport';
  const catalogActive = showAll && catalogFilterOk && !!view && view.zoom >= CATALOG_ZOOM;

  useEffect(() => {
    clearTimeout(timer.current);
    if (!catalogActive || !view) {
      setCatalog([]);
      return;
    }
    const b = view.bounds.pad(0.15);
    timer.current = window.setTimeout(() => {
      catalogInBox({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() })
        .then((r) => {
          setCatalogError(false);
          setCapped(r.capped);
          setCatalog(r.venues.filter((v): v is typeof v & { lat: number; lng: number } => v.lat != null && v.lng != null).map((v) => toView(v) as Located));
        })
        .catch(() => setCatalogError(true));
    }, 350);
    return () => clearTimeout(timer.current);
  }, [catalogActive, view]);

  const ownIds = useMemo(() => new Set(venues.map((v) => v.id)), [venues]);
  const catalogShown = useMemo(
    () => catalog.filter((v) => !ownIds.has(v.id) && (filter === 'all' || v.category === filter)),
    [catalog, ownIds, filter]
  );

  const open = async (v: Located, action: 'checkin' | 'wish' | 'details') => {
    if (action === 'wish') {
      await adoptVenue(v, { wishlist: true });
      toast('📌 Auf deiner Wunschliste');
      return;
    }
    await adoptVenue(v, null);
    nav(action === 'checkin' ? `/checkin?venue=${v.id}` : `/location/${v.id}`);
  };

  const shown = useMemo(
    () =>
      venues.filter((v): v is Located => {
        if (v.lat === null || v.lat === undefined || v.lng === null || v.lng === undefined) return false;
        if (tags.length && !tags.every((t) => v.tags.includes(t))) return false;
        if (filter === 'all') return true;
        if (filter === 'fav') return v.favorite;
        if (filter === 'wish') return v.wishlist;
        if (filter === 'sport') return v.tags.some((t) => SPORT_TAGS.includes(t));
        return v.category === filter;
      }),
    [venues, filter, tags]
  );
  const points = useMemo(() => shown.map((v) => [v.lat, v.lng] as [number, number]), [shown]);
  const usedCats = CATEGORIES.filter((c) => venues.some((v) => v.category === c.id));
  const noPin = venues.filter((v) => v.lat === null || v.lat === undefined).length;

  const locate = async () => {
    try {
      const p = await getPosition();
      setMe([p.lat, p.lng]);
    } catch {
      toast('Standort nicht verfügbar. Bitte die Freigabe prüfen.');
    }
  };

  return (
    <div className="map-wrap">
      <MapContainer center={[51.1657, 10.4515]} zoom={6} zoomControl={false} style={{ height: '100%' }}>
        <Tiles />
        <FitBounds points={points} />
        <FlyTo target={me} />
        <ZoomWatcher onZoom={setZoom} />
        <BoundsWatcher onChange={(bounds, z) => setView({ bounds, zoom: z })} />
        {me && <Marker position={me} icon={meIcon} />}
        <Clusters
          venues={shown}
          zoom={zoom}
          renderPin={(v) => {
            const cat = categoryInfo(v.category);
            return (
              <Marker key={v.id} position={[v.lat, v.lng]} icon={venueIcon(v)}>
                <Popup>
                  <div style={{ minWidth: 190 }}>
                    <div className="flex between" style={{ gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{v.name}</div>
                        <div className="small muted">{cat.emoji} {cat.label} · {v.city}</div>
                      </div>
                      <RatingBadge value={v.rating} size="sm" />
                    </div>
                    <div className="small muted mt8">{v.wishlist ? '📌 Wunschliste' : `${stats.get(v.id)?.count ?? 0}× besucht`}</div>
                    <div className="mt8"><TagList tags={v.tags.slice(0, 3)} /></div>
                    <div className="btn-row mt12">
                      <button className="btn sm" onClick={() => nav(`/location/${v.id}`)}>Details</button>
                      <button className="btn sm primary" onClick={() => nav(`/checkin?venue=${v.id}`)}>Check-in</button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          }}
        />
        {catalogShown.length > 0 && (
          <Clusters
            venues={catalogShown}
            zoom={zoom}
            renderPin={(v) => {
              const cat = categoryInfo(v.category);
              return (
                <Marker key={v.id} position={[v.lat, v.lng]} icon={catalogIcon(cat.emoji)}>
                  <Popup>
                    <div style={{ minWidth: 190 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{v.name}</div>
                      <div className="small muted">{cat.emoji} {cat.label}{v.city ? ` · ${v.city}` : ''}</div>
                      {v.address && <div className="small muted">{v.address}</div>}
                      <div className="small muted mt8">Noch nicht von dir besucht</div>
                      <div className="btn-row mt12">
                        <button className="btn sm" onClick={() => open(v, 'wish')} aria-label={`${v.name} auf die Wunschliste`}>📌</button>
                        <button className="btn sm" onClick={() => open(v, 'details')}>Details</button>
                        <button className="btn sm primary" onClick={() => open(v, 'checkin')}>Check-in</button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            }}
          />
        )}
      </MapContainer>

      <div className="map-overlay">
        <div className="chips">
          {([['all', '🌍 Alle'], ['fav', '❤️ Favoriten'], ['wish', '📌 Wunschliste'], ['sport', '⚽ Sport']] as const).map(([k, l]) => (
            <button key={k} className={`chip ${filter === k ? 'on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
          ))}
          <button className={`chip ${tags.length || showTags ? 'on' : ''}`} aria-expanded={showTags} onClick={() => setShowTags((x) => !x)}>
            🏷️ Tags{tags.length ? ` (${tags.length})` : ''}
          </button>
          {usedCats.map((c) => (
            <button key={c.id} className={`chip ${filter === c.id ? 'on' : ''}`} aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>{c.emoji} {c.label}</button>
          ))}
        </div>
        {showTags && (
          <div className="card mt8 map-tags">
            <TagPicker value={tags} onChange={setTags} />
            <div className="btn-row mt12">
              {tags.length > 0 && <button className="btn sm" onClick={() => setTags([])}>Zurücksetzen</button>}
              <button className="btn sm primary" onClick={() => setShowTags(false)}>Fertig</button>
            </div>
          </div>
        )}
        <div className="flex mt8" style={{ gap: 6, flexWrap: 'wrap' }}>
          <div className="map-count">
            {shown.length} {shown.length === 1 ? 'eigene Location' : 'eigene Locations'}
            {noPin > 0 && filter === 'all' && !tags.length ? ` · ${noPin} ohne Standort` : ''}
            {catalogActive && catalogShown.length > 0 ? ` · ${catalogShown.length}${capped ? '+' : ''} weitere` : ''}
          </div>
          {catalogFilterOk && (
            <button className={`chip small ${showAll ? 'on' : ''}`} aria-pressed={showAll} onClick={() => setShowAll((x) => !x)} style={{ pointerEvents: 'auto' }}>
              🍻 Alle Bars
            </button>
          )}
        </div>
        {showAll && catalogFilterOk && view && view.zoom < CATALOG_ZOOM && (
          <div className="map-count mt8">🔍 Hineinzoomen, um alle Bars und Clubs zu sehen</div>
        )}
        {catalogActive && capped && <div className="map-count mt8">Sehr viele Locations: weiter hineinzoomen für alle</div>}
        {catalogActive && catalogError && <div className="map-count mt8">Weitere Locations konnten nicht geladen werden</div>}
      </div>
      <div className="map-btns">
        <button className="icon-btn" onClick={locate} aria-label="Mein Standort">📍</button>
        <button className="icon-btn" onClick={() => nav('/location/neu')} aria-label="Neue Location">➕</button>
      </div>
    </div>
  );
}
