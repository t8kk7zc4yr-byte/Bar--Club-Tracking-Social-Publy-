import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Empty, RatingLegend, TagPicker } from '../../components/ui';
import { VenueRow } from '../../components/VenueRow';
import { myVenues, useStore } from '../../data/store';
import { toast } from '../../lib/notify';
import { CATEGORIES, categoryInfo, PRICE_LEVELS, type CategoryId, type TagId } from '../../lib/tags';
import { distanceM, getPosition } from '../../lib/util';
import { venueStats } from '../../lib/venueStats';

type Sort = 'rating' | 'visits' | 'recent' | 'name' | 'distance';
type Scope = 'visited' | 'fav' | 'wish' | 'all';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'rating', label: '⭐ Bewertung' },
  { key: 'visits', label: '🔁 Besuche' },
  { key: 'recent', label: '🕒 Zuletzt' },
  { key: 'distance', label: '📍 Nähe' },
  { key: 'name', label: '🔤 Name' }
];

export default function ListPage() {
  const venues = useStore(myVenues);
  const visits = useStore((s) => s.visits);
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('rating');
  const [city, setCity] = useState('');
  const [cat, setCat] = useState<CategoryId | ''>('');
  const [price, setPrice] = useState<number | null>(null);
  const [tags, setTags] = useState<TagId[]>([]);
  const initial = params.get('filter');
  const [scope, setScope] = useState<Scope>(initial === 'fav' ? 'fav' : initial === 'wish' ? 'wish' : 'visited');
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const stats = useMemo(() => venueStats(venues, visits), [venues, visits]);
  const cities = useMemo(() => [...new Set(venues.map((v) => v.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de')), [venues]);

  const chooseSort = async (s: Sort) => {
    if (s === 'distance' && !pos) {
      try {
        setPos(await getPosition());
      } catch {
        toast('Standort nicht verfügbar. Sortierung nach Nähe ist nicht möglich.');
        return;
      }
    }
    setSort(s);
  };

  const list = [...stats.values()]
    .filter(({ venue: v, count }) => {
      if (scope === 'visited' && (v.wishlist || count === 0)) return false;
      if (scope === 'fav' && !v.favorite) return false;
      if (scope === 'wish' && !v.wishlist) return false;
      if (city && v.city !== city) return false;
      if (cat && v.category !== cat) return false;
      if (price && v.priceLevel !== price) return false;
      if (tags.length && !tags.every((t) => v.tags.includes(t))) return false;
      if (q) {
        const hay = `${v.name} ${v.city} ${v.address ?? ''} ${categoryInfo(v.category).label} ${v.review ?? ''} ${v.foodNote ?? ''}`.toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      return true;
    })
    .map((s) => {
      const { lat, lng } = s.venue;
      return { s, dist: pos && lat !== null && lat !== undefined && lng !== null && lng !== undefined ? distanceM(pos, { lat, lng }) : undefined };
    })
    .sort((a, b) => {
      const A = a.s, B = b.s;
      switch (sort) {
        case 'rating': return (B.venue.rating ?? -1) - (A.venue.rating ?? -1) || B.count - A.count || A.venue.name.localeCompare(B.venue.name, 'de');
        case 'visits': return B.count - A.count || (B.venue.rating ?? -1) - (A.venue.rating ?? -1);
        case 'recent': return (B.lastVisit ?? '').localeCompare(A.lastVisit ?? '');
        case 'name': return A.venue.name.localeCompare(B.venue.name, 'de');
        case 'distance': return (a.dist ?? Infinity) - (b.dist ?? Infinity);
      }
    });

  const activeFilters = (city ? 1 : 0) + (cat ? 1 : 0) + (price ? 1 : 0) + tags.length;
  const reset = () => {
    setCity('');
    setCat('');
    setPrice(null);
    setTags([]);
  };

  return (
    <div className="page">
      <div className="top">
        <div>
          <h1>Ranking</h1>
          <div className="sub">{list.length} von {venues.length} Locations</div>
        </div>
        <Link to="/location/neu" className="btn sm primary">+ Location</Link>
      </div>

      <div className="search">
        <input className="input" placeholder="Suche nach Name, Stadt, Notiz …" aria-label="Locations durchsuchen" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
      </div>

      <div className="seg mt12" role="radiogroup" aria-label="Auswahl">
        {([['visited', 'Besucht'], ['fav', '❤️ Favoriten'], ['wish', '📌 Wunschliste'], ['all', 'Alle']] as const).map(([k, l]) => (
          <button key={k} role="radio" aria-checked={scope === k} className={scope === k ? 'on' : ''} onClick={() => setScope(k)}>{l}</button>
        ))}
      </div>

      <div className="chips mt12">
        <button className={`chip ${activeFilters ? 'on' : ''}`} aria-expanded={showFilters} onClick={() => setShowFilters((x) => !x)}>
          ⚙️ Filter{activeFilters ? ` (${activeFilters})` : ''}
        </button>
        {SORTS.map((s) => (
          <button key={s.key} className={`chip ${sort === s.key ? 'on' : ''}`} aria-pressed={sort === s.key} onClick={() => chooseSort(s.key)}>{s.label}</button>
        ))}
      </div>

      {showFilters && (
        <div className="card mt12">
          <label className="field">
            <span>Stadt</span>
            <select className="input" value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Alle Städte</option>
              {cities.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <div className="field">
            <span>Art</span>
            <div className="chips wrap">
              {CATEGORIES.map((c) => (
                <button key={c.id} className={`chip small ${cat === c.id ? 'on' : ''}`} aria-pressed={cat === c.id} onClick={() => setCat(cat === c.id ? '' : c.id)}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Preisklasse</span>
            <div className="chips">
              {PRICE_LEVELS.map((p) => (
                <button key={p} className={`chip small ${price === p ? 'on' : ''}`} aria-pressed={price === p} onClick={() => setPrice(price === p ? null : p)}>{'€'.repeat(p)}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Tags (alle gewählten müssen zutreffen)</span>
            <TagPicker value={tags} onChange={setTags} />
          </div>
          {activeFilters > 0 && <button className="btn sm" onClick={reset}>Filter zurücksetzen</button>}
        </div>
      )}

      <div style={{ margin: '12px 2px' }}><RatingLegend /></div>

      {list.length ? (
        list.map(({ s, dist }, i) => (
          <VenueRow key={s.venue.id} s={s} rank={sort === 'rating' || sort === 'visits' ? i + 1 : undefined} distance={dist} />
        ))
      ) : venues.length ? (
        <Empty emoji="🔍" title="Nichts gefunden">Passe Suche, Auswahl oder Filter an.</Empty>
      ) : (
        <Empty emoji="🏆" title="Noch keine Locations">Dein Ranking füllt sich mit dem ersten Check-in.</Empty>
      )}
    </div>
  );
}
