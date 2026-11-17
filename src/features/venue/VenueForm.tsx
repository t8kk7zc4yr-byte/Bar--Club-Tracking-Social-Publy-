import { useState } from 'react';
import { MapContainer, Marker } from 'react-leaflet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClickHandler, FlyTo, Tiles, venueIcon } from '../../components/MapBits';
import { Header, Toggle } from '../../components/ui';
import { reversePlace, searchPlaces, type Place } from '../../data/osm';
import { addVenue, getState } from '../../data/store';
import { toast } from '../../lib/notify';
import { CATEGORIES, type CategoryId } from '../../lib/tags';
import { getPosition } from '../../lib/util';

const num = (s: string | null) => (s !== null && s !== '' && Number.isFinite(Number(s)) ? Number(s) : null);

/** Neue Location anlegen (Name, Art, Ort). Bewertung und Tags folgen beim Check-in. */
export default function VenueForm() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [name, setName] = useState(params.get('name') ?? '');
  const [category, setCategory] = useState<CategoryId>('bar');
  const [city, setCity] = useState(params.get('city') ?? '');
  const [address, setAddress] = useState(params.get('address') ?? '');
  const [lat, setLat] = useState<number | null>(num(params.get('lat')));
  const [lng, setLng] = useState<number | null>(num(params.get('lng')));
  const [osmId, setOsmId] = useState<string | undefined>();
  const [wishlist, setWishlist] = useState(params.get('wish') === '1');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fly, setFly] = useState<[number, number] | null>(null);
  const hasPin = lat !== null && lng !== null;

  const apply = (p: Place) => {
    setLat(p.lat);
    setLng(p.lng);
    if (p.city) setCity(p.city);
    if (p.address) setAddress(p.address);
    if (p.name && !name.trim()) setName(p.name);
    if (p.osmId) {
      setOsmId(p.osmId);
      setCategory(p.category);
    }
    setFly([p.lat, p.lng]);
    setResults([]);
  };

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await searchPlaces(query + (city && !query.includes(city) ? ` ${city}` : ''), hasPin ? { lat: lat!, lng: lng! } : null);
      setResults(r);
      if (!r.length) toast('Keine Treffer. Setze den Pin per Tipp auf die Karte.');
    } catch {
      toast('Suche gerade nicht erreichbar. Setze den Pin per Tipp auf die Karte.');
    } finally {
      setSearching(false);
    }
  };

  const setPin = async (la: number, ln: number, fromGps = false) => {
    setLat(la);
    setLng(ln);
    setOsmId(undefined);
    if (fromGps) setFly([la, ln]);
    const g = await reversePlace(la, ln);
    if (g) {
      setCity((c) => c || g.city);
      setAddress((a) => (fromGps || !a ? g.address : a));
    }
  };

  const useGps = async () => {
    try {
      const p = await getPosition();
      await setPin(p.lat, p.lng, true);
    } catch {
      toast('Standort nicht verfügbar. Bitte die Freigabe prüfen.');
    }
  };

  const save = async () => {
    if (!name.trim()) return toast('Bitte einen Namen eingeben');
    if (!city.trim()) return toast('Bitte eine Stadt angeben');
    const dupe = getState().venues.find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase() && x.city.trim().toLowerCase() === city.trim().toLowerCase());
    if (dupe && !confirm(`„${dupe.name}“ in ${dupe.city} gibt es schon. Trotzdem neu anlegen?`)) return;
    setSaving(true);
    const forCheckin = params.get('return') === 'checkin';
    const id = await addVenue({ name, category, city, address, lat, lng, osmId }, forCheckin && !wishlist ? null : { wishlist });
    if (forCheckin && !wishlist) nav(`/checkin?venue=${id}`, { replace: true });
    else {
      toast(wishlist ? '📌 Auf der Wunschliste' : 'Location angelegt');
      nav(`/location/${id}`, { replace: true });
    }
  };

  return (
    <div className="page no-tabbar">
      <Header back title="Neue Location" />

      <label className="field">
        <span>Name</span>
        <input className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="z. B. Zum Goldenen Zapfhahn" />
      </label>

      <div className="field">
        <span>Art der Location</span>
        <div className="chips wrap">
          {CATEGORIES.map((c) => (
            <button type="button" key={c.id} className={`chip ${category === c.id ? 'on' : ''}`} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Ort</span>
        <div className="row">
          <div className="search" style={{ flex: 3 }}>
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Adresse oder Name suchen" type="search" />
          </div>
          <button type="button" className="btn" style={{ flex: 'none' }} onClick={search} disabled={searching}>{searching ? '…' : 'Suchen'}</button>
        </div>
        {results.length > 0 && (
          <div className="suggest">
            {results.map((r, i) => (
              <button type="button" key={i} onClick={() => apply(r)}>
                <div style={{ fontWeight: 600 }}>{r.name || r.address || r.city}</div>
                <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
              </button>
            ))}
          </div>
        )}
        <div className="mini-map mt8">
          <MapContainer center={hasPin ? [lat!, lng!] : [51.1657, 10.4515]} zoom={hasPin ? 16 : 5} zoomControl={false}>
            <Tiles />
            <ClickHandler onClick={(la, ln) => setPin(la, ln)} />
            <FlyTo target={fly} zoom={16} />
            {hasPin && <Marker position={[lat!, lng!]} icon={venueIcon({ rating: null, wishlist, favorite: false })} />}
          </MapContainer>
        </div>
        <div className="flex between mt8">
          <span className="small muted">{hasPin ? '✅ Pin gesetzt. Tippen verschiebt ihn.' : 'Tippe auf die Karte, um den Pin zu setzen'}</span>
          <button type="button" className="btn sm" onClick={useGps}>📍 Hier bin ich</button>
        </div>
      </div>

      <label className="field">
        <span>Stadt</span>
        <input className="input" value={city} maxLength={80} onChange={(e) => setCity(e.target.value)} placeholder="Köln" />
      </label>
      <label className="field">
        <span>Adresse</span>
        <input className="input" value={address} maxLength={200} onChange={(e) => setAddress(e.target.value)} placeholder="Straße Nr., PLZ Ort" />
      </label>

      <div className="card" style={{ padding: '2px 14px', marginBottom: 14 }}>
        <div className="switch">
          <div><div className="t">📌 Wunschliste</div><div className="s">Noch nicht dort gewesen, will ich hin</div></div>
          <Toggle label="Wunschliste" checked={wishlist} onChange={setWishlist} />
        </div>
      </div>
      <div className="small muted">Name, Art und Ort sind für alle Nutzer der App sichtbar. Deine Bewertung und deine Tags bleiben bei dir.</div>

      <div className="sticky-actions">
        <button className="btn primary block" onClick={save} disabled={saving}>Location anlegen</button>
      </div>
    </div>
  );
}
