import { useMemo, useRef, useState } from 'react';
import { MapContainer, Marker } from 'react-leaflet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Tiles, venueIcon } from '../../components/MapBits';
import { Empty, PhotoImg, PricePicker, RatingBadge, RatingPicker, TagList, TagPicker } from '../../components/ui';
import { addPhoto, deletePhoto, patchUserVenue, removeMyVenue, toView, useStore } from '../../data/store';
import { toast } from '../../lib/notify';
import { fmtRating, tierFor } from '../../lib/rating';
import { categoryInfo, fmtPrice, type TagId } from '../../lib/tags';
import { euro, fmtDate, MONTHS_SHORT, relTime } from '../../lib/util';
import { venueStats } from '../../lib/venueStats';

export default function VenueDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const venueRow = useStore((s) => s.venues.find((v) => v.id === id));
  const userVenue = useStore((s) => s.userVenues.find((u) => u.venueId === id));
  const venue = useMemo(() => (venueRow ? toView(venueRow, userVenue) : undefined), [venueRow, userVenue]);
  const visits = useStore((s) => s.visits);
  const allPhotos = useStore((s) => s.photos);
  const photos = useMemo(() => allPhotos.filter((p) => p.venueId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [allPhotos, id]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(false);
  const [editing, setEditing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const s = useMemo(() => (venue ? venueStats([venue], visits).get(venue.id)! : null), [venue, visits]);

  if (!venue || !s) {
    return (
      <div className="page">
        <Empty emoji="🤷" title="Location nicht gefunden">
          <Link to="/liste" style={{ color: 'var(--accent)' }}>Zur Liste</Link>
        </Empty>
      </div>
    );
  }

  const cat = categoryInfo(venue.category);
  const hasPin = venue.lat !== null && venue.lat !== undefined && venue.lng !== null && venue.lng !== undefined;
  const trend = [...s.visits].reverse().filter((v) => typeof v.rating === 'number').map((v) => {
    const d = new Date(v.visitedAt);
    return { label: `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`, rating: v.rating };
  });

  const onPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    let first: string | undefined;
    for (const f of Array.from(files)) {
      const pid = await addPhoto(f, venue.id);
      first ??= pid;
    }
    if (!venue.coverPhotoId && first) await patchUserVenue(venue.id, { coverPhotoId: first });
    toast('📸 Foto gespeichert');
  };

  const share = async () => {
    const text = venue.rating !== null ? `${venue.name} (${venue.city}): von mir mit ${fmtRating(venue.rating)}/10 bewertet 🍻` : `${venue.name} (${venue.city}) 🍻`;
    try {
      if (navigator.share) await navigator.share({ title: venue.name, text });
      else {
        await navigator.clipboard.writeText(text);
        toast('In die Zwischenablage kopiert');
      }
    } catch {
      /* abgebrochen */
    }
  };

  const query = encodeURIComponent(`${venue.name} ${venue.address ?? ''} ${venue.city}`);
  const googleUrl = hasPin ? `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}` : `https://www.google.com/maps/search/?api=1&query=${query}`;
  const appleUrl = hasPin ? `https://maps.apple.com/?daddr=${venue.lat},${venue.lng}` : `https://maps.apple.com/?q=${query}`;

  const remove = async () => {
    const what = s.count ? ` mit ${s.count === 1 ? 'einem Besuch' : `allen ${s.count} Besuchen`} und zugehörigen Fotos` : '';
    if (!confirm(`„${venue.name}“${what} aus deiner Liste entfernen? Das lässt sich nicht rückgängig machen.`)) return;
    await removeMyVenue(venue.id);
    toast('Aus deiner Liste entfernt');
    nav('/liste', { replace: true });
  };

  return (
    <div className="page">
      <div className="cover">
        {venue.coverPhotoId ? <PhotoImg id={venue.coverPhotoId} /> : <div className="emoji">{cat.emoji}</div>}
        <div className="cover-btns">
          <button className="icon-btn" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} aria-label="Zurück">‹</button>
          <div className="flex">
            <button className={`icon-btn ${venue.favorite ? 'on' : ''}`} aria-pressed={venue.favorite} onClick={() => patchUserVenue(venue.id, { favorite: !venue.favorite })} aria-label="Favorit">
              {venue.favorite ? '❤️' : '🤍'}
            </button>
            <button className={`icon-btn ${venue.wishlist ? 'on' : ''}`} aria-pressed={venue.wishlist} onClick={() => patchUserVenue(venue.id, { wishlist: !venue.wishlist })} aria-label="Wunschliste">
              📌
            </button>
            <button className="icon-btn" onClick={share} aria-label="Teilen">📤</button>
          </div>
        </div>
      </div>

      <div className="detail-head">
        <div className="grow">
          <h1>{venue.name}</h1>
          <div className="muted small">
            {cat.emoji} {cat.label}{venue.city ? ` · ${venue.city}` : ''}{venue.priceLevel ? ` · ${fmtPrice(venue.priceLevel)}` : ''}
          </div>
          {venue.address && <div className="muted small">{venue.address}</div>}
        </div>
        <button onClick={() => setEditRating((x) => !x)} style={{ background: 'none', border: 0, padding: 0 }} aria-label="Gesamtbewertung ändern">
          <RatingBadge value={venue.rating} size="lg" />
        </button>
      </div>
      <div className="small mt8" style={{ color: tierFor(venue.rating).key === 'none' ? 'var(--muted)' : 'var(--text)' }}>
        {venue.wishlist ? '📌 Auf deiner Wunschliste' : tierFor(venue.rating).label}
        <span className="muted"> · tippe auf die Zahl zum Ändern</span>
      </div>
      {editRating && (
        <div className="card mt12">
          <RatingPicker
            value={venue.rating}
            onChange={(r) => {
              patchUserVenue(venue.id, { rating: r });
              setEditRating(false);
            }}
          />
        </div>
      )}

      <div className="mt12"><TagList tags={venue.tags} /></div>
      {venue.foodNote && <div className="small muted mt8">🍽️ {venue.foodNote}</div>}
      {venue.review && !editing && <div className="card mt12" style={{ whiteSpace: 'pre-wrap' }}>{venue.review}</div>}

      {editing ? (
        <PersonalEditor
          key={venue.id}
          initial={{ tags: venue.tags, priceLevel: venue.priceLevel, foodNote: venue.foodNote ?? '', review: venue.review ?? '' }}
          onCancel={() => setEditing(false)}
          onSave={async (v) => {
            await patchUserVenue(venue.id, { tags: v.tags, priceLevel: v.priceLevel, foodNote: v.foodNote.trim() || null, review: v.review.trim() || null });
            setEditing(false);
            toast('Gespeichert');
          }}
        />
      ) : (
        <button className="btn sm mt12" onClick={() => setEditing(true)}>✏️ Tags, Preisklasse und Beschreibung bearbeiten</button>
      )}

      <button className="btn primary block mt16" onClick={() => nav(`/checkin?venue=${venue.id}`)}>🍻 Check-in</button>
      <div className="btn-row mt8">
        <a className="btn sm" href={googleUrl} target="_blank" rel="noreferrer">🧭 Google Maps</a>
        <a className="btn sm" href={appleUrl} target="_blank" rel="noreferrer">🧭 Apple Karten</a>
      </div>

      <div className="stat-grid mt16">
        <div className="stat"><div className="v">{s.count}</div><div className="l">Besuche</div></div>
        <div className="stat"><div className="v">{s.avgVisitRating !== null ? fmtRating(Math.round(s.avgVisitRating * 10) / 10) : '–'}</div><div className="l">Ø Besuch</div></div>
        <div className="stat"><div className="v" style={{ fontSize: s.totalSpend >= 1000 ? 16 : 20 }}>{s.totalSpend ? euro(s.totalSpend) : '–'}</div><div className="l">ausgegeben</div></div>
      </div>
      {s.count > 0 && (
        <div className="small muted mt8 center">Erster Besuch {fmtDate(s.firstVisit!)} · zuletzt {relTime(s.lastVisit!)}</div>
      )}

      {trend.length >= 2 && (
        <div className="section">
          <div className="section-h"><h2>📈 Bewertung pro Besuch</h2></div>
          <div className="card">
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={trend} margin={{ top: 8, right: 8, left: -26, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'var(--muted)' }} minTickGap={16} />
                <YAxis domain={[1, 10]} ticks={[1, 4, 7, 10]} tickLine={false} axisLine={false} width={44} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <Tooltip contentStyle={{ background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--text)' }} formatter={(v) => [`${v}/10`, 'Bewertung']} />
                <Line type="monotone" dataKey="rating" stroke="var(--accent)" strokeWidth={2} dot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--card)', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-h">
          <h2>📸 Fotos</h2>
          <span className="small muted">{photos.length}</span>
        </div>
        <div className="photos">
          <button className="add-photo" onClick={() => fileRef.current?.click()}>📷<br />Foto / Selfie</button>
          {photos.map((p) => (
            <div className="ph" key={p.id}>
              <PhotoImg id={p.id} onClick={() => setLightbox(p.id)} />
            </div>
          ))}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onPhotos(e.target.files); e.target.value = ''; }} />
        <p className="small muted mt8">Fotos sind privat. Bei Bildern mit anderen Personen vorher deren Einverständnis einholen.</p>
      </div>

      <div className="section">
        <div className="section-h">
          <h2>🗓️ Besuche</h2>
          <Link to={`/checkin?venue=${venue.id}`}>+ Besuch</Link>
        </div>
        {s.visits.length ? (
          <div className="card timeline" style={{ padding: '0 14px' }}>
            {s.visits.map((v) => {
              const d = new Date(v.visitedAt);
              const n = allPhotos.filter((p) => p.visitId === v.id).length;
              return (
                <Link to={`/besuch/${v.id}`} className="item" key={v.id}>
                  <div className="date">
                    <div className="d">{d.getDate()}</div>
                    <div className="m">{MONTHS_SHORT[d.getMonth()]} {String(d.getFullYear()).slice(2)}</div>
                  </div>
                  <div className="grow">
                    <div className="small muted">
                      {d.toLocaleDateString('de-DE', { weekday: 'long' })}, {d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                      {v.spend ? ` · ${euro(v.spend)}` : ''}
                    </div>
                    {v.drinks.length > 0 && <div className="small">{v.drinks.map((x) => `${x.count}× ${x.name}`).join(', ')}</div>}
                    {v.companionsText.length > 0 && <div className="small muted">mit {v.companionsText.join(', ')}</div>}
                    {v.note && <div className="small" style={{ fontStyle: 'italic' }}>„{v.note}“</div>}
                    {n > 0 && <div className="small muted">📸 {n} Foto{n > 1 ? 's' : ''}</div>}
                  </div>
                  {typeof v.rating === 'number' && <RatingBadge value={v.rating} size="sm" />}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card small muted">Noch keine Besuche. Tippe auf „Check-in“, wenn du dort bist.</div>
        )}
      </div>

      {hasPin && (
        <div className="section">
          <div className="mini-map">
            <MapContainer center={[venue.lat!, venue.lng!]} zoom={16} zoomControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false}>
              <Tiles />
              <Marker position={[venue.lat!, venue.lng!]} icon={venueIcon(venue)} />
            </MapContainer>
          </div>
        </div>
      )}

      <div className="section">
        <button className="btn danger block" onClick={remove}>Aus meiner Liste entfernen</button>
      </div>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
            <PhotoImg id={lightbox} />
            <div className="btn-row" style={{ width: '100%' }}>
              <button className="btn sm" onClick={() => { patchUserVenue(venue.id, { coverPhotoId: lightbox }); setLightbox(null); toast('Titelbild gesetzt'); }}>Als Titelbild</button>
              <button
                className="btn sm danger"
                onClick={async () => {
                  if (!confirm('Foto löschen?')) return;
                  if (venue.coverPhotoId === lightbox) await patchUserVenue(venue.id, { coverPhotoId: null });
                  await deletePhoto(lightbox);
                  setLightbox(null);
                }}
              >
                Löschen
              </button>
              <button className="btn sm" onClick={() => setLightbox(null)}>Schließen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface Personal {
  tags: TagId[];
  priceLevel: number | null;
  foodNote: string;
  review: string;
}

function PersonalEditor({ initial, onSave, onCancel }: { initial: Personal; onSave: (v: Personal) => void; onCancel: () => void }) {
  const [v, setV] = useState(initial);
  const hasFood = v.tags.includes('snacks') || v.tags.includes('kueche');
  return (
    <div className="card mt12">
      <label className="field">
        <span>Deine Beschreibung (optional)</span>
        <textarea className="input" maxLength={2000} value={v.review} onChange={(e) => setV({ ...v, review: e.target.value })} placeholder="Was macht die Location aus? Türsteher, Musik, beste Getränke …" />
      </label>
      <div className="field">
        <span>Preisklasse</span>
        <PricePicker value={v.priceLevel} onChange={(p) => setV({ ...v, priceLevel: p })} />
      </div>
      <TagPicker value={v.tags} onChange={(tags) => setV({ ...v, tags })} />
      {hasFood && (
        <label className="field" style={{ margin: '12px 0 0' }}>
          <span>Was gibt es zu essen? (optional)</span>
          <input className="input" maxLength={300} value={v.foodNote} onChange={(e) => setV({ ...v, foodNote: e.target.value })} />
        </label>
      )}
      <div className="btn-row mt16">
        <button className="btn" onClick={onCancel}>Abbrechen</button>
        <button className="btn primary" onClick={() => onSave({ ...v, foodNote: hasFood ? v.foodNote : '' })}>Speichern</button>
      </div>
    </div>
  );
}
