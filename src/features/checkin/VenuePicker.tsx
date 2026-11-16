import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header, RatingBadge } from '../../components/ui';
import { catalogNearby, catalogSearch, nearbyPlaces, reversePlace, searchPlaces, type Place } from '../../data/osm';
import { addVenue, adoptVenue, myVenues, useStore } from '../../data/store';
import { toast } from '../../lib/notify';
import { categoryInfo } from '../../lib/tags';
import type { Venue } from '../../lib/types';
import { distanceM, fmtDistance, getPosition } from '../../lib/util';

type Pos = { lat: number; lng: number };

/** Ein Eintrag der Auswahlliste: eigene Location, Katalogeintrag oder Vorschlag aus OpenStreetMap */
interface Item {
  key: string;
  name: string;
  city: string;
  emoji: string;
  rating?: number | null;
  wishlist?: boolean;
  d?: number;
  own?: string;
  catalog?: Venue;
  place?: Place;
}

const HERE_M = 80;

export default function VenuePicker() {
  const own = useStore(myVenues);
  const known = useStore((s) => s.venues);
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [pos, setPos] = useState<Pos | null>(null);
  const [locating, setLocating] = useState(true);
  const [catalog, setCatalog] = useState<Venue[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [posCity, setPosCity] = useState('');
  const [found, setFound] = useState<Item[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    getPosition()
      .then((p) => {
        if (!live) return;
        setPos(p);
        catalogNearby(p).then((v) => live && setCatalog(v));
        nearbyPlaces(p).then((v) => live && setPlaces(v)).catch(() => {});
        reversePlace(p.lat, p.lng).then((r) => live && r && setPosCity(r.city));
      })
      .catch(() => {})
      .finally(() => live && setLocating(false));
    return () => {
      live = false;
    };
  }, []);

  const dist = (lat?: number | null, lng?: number | null) =>
    pos && lat !== null && lat !== undefined && lng !== null && lng !== undefined ? distanceM(pos, { lat, lng }) : undefined;

  const items = useMemo(() => {
    const out: Item[] = own.map((v) => ({
      key: v.id, name: v.name, city: v.city, emoji: categoryInfo(v.category).emoji, rating: v.rating, wishlist: v.wishlist,
      d: dist(v.lat, v.lng), own: v.id
    }));
    const ids = new Set(own.map((v) => v.id));
    const osm = new Set(own.map((v) => v.osmId).filter(Boolean));
    for (const v of catalog) {
      if (ids.has(v.id)) continue;
      ids.add(v.id);
      if (v.osmId) osm.add(v.osmId);
      out.push({ key: v.id, name: v.name, city: v.city, emoji: categoryInfo(v.category).emoji, d: dist(v.lat, v.lng), catalog: v });
    }
    for (const p of places) {
      if (!p.osmId || osm.has(p.osmId)) continue;
      out.push({ key: p.osmId, name: p.name ?? '', city: p.city || posCity, emoji: categoryInfo(p.category).emoji, d: dist(p.lat, p.lng), place: p });
    }
    const term = q.trim().toLowerCase();
    return out
      .filter((x) => !term || `${x.name} ${x.city}`.toLowerCase().includes(term))
      .sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity) || a.name.localeCompare(b.name, 'de'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [own, catalog, places, pos, posCity, q]);

  const here = q ? [] : items.filter((x) => x.d !== undefined && x.d < HERE_M).slice(0, 3);
  const rest = items.filter((x) => !here.includes(x));

  const choose = async (it: Item) => {
    if (busy) return;
    setBusy(true);
    try {
      let id = it.own;
      if (it.catalog) id = await adoptVenue(it.catalog, null);
      if (it.place) {
        const p = it.place;
        const existing = known.find((v) => p.osmId && v.osmId === p.osmId);
        if (existing) id = existing.id;
        else if (!p.name || !p.osmId) {
          // Reine Adresse ohne Namen: im Formular vervollständigen
          const params = new URLSearchParams({ return: 'checkin', lat: String(p.lat), lng: String(p.lng), city: p.city, address: p.address, name: p.name ?? q });
          return nav(`/location/neu?${params}`);
        } else {
          id = await addVenue(
            { name: p.name, category: p.category, city: p.city || posCity || 'Unbekannt', address: p.address, lat: p.lat, lng: p.lng, osmId: p.osmId },
            null
          );
        }
      }
      nav(`/checkin?venue=${id}`, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const searchEverywhere = async () => {
    const term = q.trim();
    if (term.length < 2) return;
    setSearching(true);
    try {
      const [cat, osm] = await Promise.all([catalogSearch(term), searchPlaces(term, pos).catch(() => [] as Place[])]);
      const seen = new Set(cat.map((v) => v.osmId).filter(Boolean));
      const res: Item[] = [
        ...cat.map((v) => ({ key: v.id, name: v.name, city: v.city, emoji: categoryInfo(v.category).emoji, d: dist(v.lat, v.lng), catalog: v })),
        ...osm
          .filter((p) => !p.osmId || !seen.has(p.osmId))
          .map((p, i) => ({ key: p.osmId ?? `adr-${i}`, name: p.name || p.address || p.city, city: p.city, emoji: p.osmId ? categoryInfo(p.category).emoji : '📍', d: dist(p.lat, p.lng), place: p }))
      ];
      setFound(res);
      if (!res.length) toast('Keine Treffer. Lege die Location einfach neu an.');
    } finally {
      setSearching(false);
    }
  };

  const Row = ({ it, highlight }: { it: Item; highlight?: boolean }) => (
    <button className="vrow" style={{ width: '100%', textAlign: 'left', borderColor: highlight ? 'var(--accent)' : undefined }} onClick={() => choose(it)} disabled={busy}>
      <span className="thumb" style={{ display: 'grid', placeItems: 'center', fontSize: 24 }}>{it.emoji}</span>
      <div className="main">
        <div className="name">{it.wishlist && '📌 '}{it.name}</div>
        <div className="meta">
          {[it.city, it.d !== undefined ? (highlight ? `${fmtDistance(it.d)} entfernt` : fmtDistance(it.d)) : '', !it.own ? 'neu für dich' : ''].filter(Boolean).join(' · ')}
        </div>
      </div>
      {it.own && <RatingBadge value={it.rating} size="sm" />}
    </button>
  );

  return (
    <div className="page no-tabbar">
      <Header back title="Check-in" sub="Wo bist du gerade?" />
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          searchEverywhere();
        }}
      >
        <div className="search" style={{ flex: 3 }}>
          <input
            className="input" placeholder="Location suchen …" value={q} type="search" aria-label="Location suchen"
            onChange={(e) => {
              setQ(e.target.value);
              setFound(null);
            }}
          />
        </div>
        {q.trim().length >= 2 && (
          <button className="btn" style={{ flex: 'none' }} disabled={searching}>{searching ? '…' : 'Überall suchen'}</button>
        )}
      </form>

      <Link to={`/location/neu?return=checkin${q ? `&name=${encodeURIComponent(q)}` : ''}`} className="vrow mt12" style={{ borderStyle: 'dashed' }}>
        <span className="thumb" style={{ display: 'grid', placeItems: 'center', fontSize: 24 }}>➕</span>
        <div className="main">
          <div className="name">{q ? `„${q}“ neu anlegen` : 'Neue Location anlegen'}</div>
          <div className="meta">Bar, Club, Kneipe … mit Standort</div>
        </div>
      </Link>

      {found && (
        <div className="section">
          <div className="section-h"><h2>🔎 Suchergebnisse</h2></div>
          {found.map((it) => <Row key={it.key} it={it} />)}
          {!found.length && <div className="small muted">Nichts gefunden.</div>}
        </div>
      )}

      {here.length > 0 && (
        <div className="section">
          <div className="section-h"><h2>📍 Du bist vermutlich hier</h2></div>
          {here.map((it) => <Row key={it.key} it={it} highlight />)}
        </div>
      )}

      <div className="section">
        <div className="section-h">
          <h2>{pos ? 'In der Nähe' : 'Deine Locations'}</h2>
          {locating && <span className="small muted">Standort wird gesucht …</span>}
        </div>
        {rest.map((it) => <Row key={it.key} it={it} />)}
        {!rest.length && !here.length && (
          <div className="small muted">
            {q ? 'Keine passende Location in deiner Liste. Tippe auf „Überall suchen“ oder lege sie neu an.' : 'Noch keine Locations. Erlaube den Standort für Vorschläge oder lege eine neue an.'}
          </div>
        )}
      </div>
      <p className="small muted mt16">Vorschläge und Karten: © OpenStreetMap-Mitwirkende</p>
    </div>
  );
}
