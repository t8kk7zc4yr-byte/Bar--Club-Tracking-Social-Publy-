import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Header, PhotoImg, PricePicker, RatingPicker, TagPicker, Toggle } from '../../components/ui';
import { addPhoto, deletePhoto, deleteVisit, patchUserVenue, saveVisit, toView, useStore } from '../../data/store';
import { toast } from '../../lib/notify';
import { categoryInfo, type TagId } from '../../lib/tags';
import type { Drink } from '../../lib/types';
import { toLocalInput, uid } from '../../lib/util';
import VenuePicker from './VenuePicker';

const COMMON_DRINKS = ['Bier', 'Pils', 'Kölsch', 'Altbier', 'Weizen', 'Guinness', 'Aperol Spritz', 'Gin Tonic', 'Cocktail', 'Wein', 'Longdrink', 'Shot', 'Alkoholfrei'];

export default function CheckIn() {
  const { visitId } = useParams();
  const [params] = useSearchParams();
  const existing = useStore((s) => (visitId ? s.visits.find((v) => v.id === visitId) : undefined));
  const venueId = existing?.venueId ?? params.get('venue');
  if (!venueId) return <VenuePicker />;
  // key: Formular neu aufbauen, wenn eine andere Location oder ein anderer Besuch geöffnet wird
  return <Form key={visitId ?? venueId} venueId={venueId} visitId={visitId} />;
}

function Form({ venueId, visitId }: { venueId: string; visitId?: string }) {
  const nav = useNavigate();
  const existing = useStore((s) => (visitId ? s.visits.find((v) => v.id === visitId) : undefined));
  // Zwei stabile Auswahlen und erst danach zusammenführen (ein neu gebautes Objekt im Selektor löst eine Endlosschleife aus)
  const venueRow = useStore((s) => s.venues.find((v) => v.id === venueId));
  const userVenue = useStore((s) => s.userVenues.find((u) => u.venueId === venueId));
  const venue = useMemo(() => (venueRow ? toView(venueRow, userVenue) : undefined), [venueRow, userVenue]);
  const allVisits = useStore((s) => s.visits);
  const [id] = useState(() => existing?.id ?? uid());
  const allPhotos = useStore((s) => s.photos);
  const photos = useMemo(() => allPhotos.filter((p) => p.visitId === id), [allPhotos, id]);
  const fileRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(() => toLocalInput(existing ? new Date(existing.visitedAt) : new Date()));
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);
  const [updateOverall, setUpdateOverall] = useState(venue?.rating === null || venue?.rating === undefined);
  const [tags, setTags] = useState<TagId[]>(venue?.tags ?? []);
  const [price, setPrice] = useState<number | null>(venue?.priceLevel ?? null);
  const [foodNote, setFoodNote] = useState(venue?.foodNote ?? '');
  const [drinks, setDrinks] = useState<Drink[]>(existing?.drinks ?? []);
  const [customDrink, setCustomDrink] = useState('');
  const [spend, setSpend] = useState(() => {
    const v = existing?.spend;
    return v === null || v === undefined ? '' : (Number.isInteger(v) ? String(v) : v.toFixed(2)).replace('.', ',');
  });
  const [companions, setCompanions] = useState<string[]>(existing?.companionsText ?? []);
  const [companionInput, setCompanionInput] = useState('');
  const [note, setNote] = useState(existing?.note ?? '');
  const [saving, setSaving] = useState(false);

  const usedDrinks = useMemo(() => {
    const m = new Map<string, number>();
    allVisits.forEach((v) => v.drinks.forEach((d) => m.set(d.name, (m.get(d.name) ?? 0) + d.count)));
    const top = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
    return [...new Set([...top.slice(0, 6), ...COMMON_DRINKS])].slice(0, 14);
  }, [allVisits]);

  const knownCompanions = useMemo(() => {
    const m = new Map<string, number>();
    allVisits.forEach((v) => v.companionsText.forEach((n) => m.set(n, (m.get(n) ?? 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 8);
  }, [allVisits]);

  if (!venue) {
    return (
      <div className="page no-tabbar">
        <Header back title="Location nicht gefunden" />
      </div>
    );
  }

  const cat = categoryInfo(venue.category);
  const addDrink = (name: string, delta = 1) => {
    setDrinks((ds) => {
      const ex = ds.find((d) => d.name === name);
      if (!ex) return delta > 0 ? [...ds, { name, count: delta }] : ds;
      const count = ex.count + delta;
      return count <= 0 ? ds.filter((d) => d.name !== name) : ds.map((d) => (d.name === name ? { ...d, count } : d));
    });
  };
  const totalDrinks = drinks.reduce((a, d) => a + d.count, 0);
  const addCompanion = () => {
    const n = companionInput.trim();
    if (n) setCompanions((c) => [...new Set([...c, n])]);
    setCompanionInput('');
  };
  const hasFood = tags.includes('snacks') || tags.includes('kueche');

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) await addPhoto(f, venue.id, id);
  };

  const save = async () => {
    const when = new Date(date);
    if (Number.isNaN(when.getTime())) return toast('Bitte Datum und Uhrzeit angeben');
    setSaving(true);
    const firstTime = !allVisits.some((v) => v.venueId === venue.id && v.id !== id);
    const amount = spend ? parseFloat(spend.replace(',', '.')) : NaN;
    await saveVisit({
      id,
      venueId: venue.id,
      visitedAt: when.toISOString(),
      rating,
      note: note.trim() || null,
      drinks,
      spend: Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100) / 100) : null,
      companionsText: companions,
      tourId: existing?.tourId ?? null
    });
    await patchUserVenue(venue.id, {
      tags,
      priceLevel: price,
      foodNote: hasFood ? foodNote.trim() || null : null,
      ...(rating !== null && updateOverall ? { rating } : {}),
      ...(!venue.coverPhotoId && photos[0] ? { coverPhotoId: photos[0].id } : {})
    });
    toast(existing ? 'Besuch aktualisiert' : firstTime ? `🎉 Neue Location: ${venue.name}!` : `🍻 Check-in bei ${venue.name}`);
    nav(`/location/${venue.id}`, { replace: true });
  };

  const remove = async () => {
    if (!existing || !confirm('Diesen Besuch löschen?')) return;
    await deleteVisit(existing.id);
    nav(-1);
  };

  const cancel = async () => {
    // beim Abbrechen eines neuen Check-ins bereits hinzugefügte Fotos wieder entfernen
    if (!existing) for (const p of photos) await deletePhoto(p.id);
    nav(-1);
  };

  return (
    <div className="page no-tabbar">
      <Header
        back={!!existing}
        title={existing ? 'Besuch bearbeiten' : 'Check-in'}
        sub={<>{cat.emoji} {venue.name}{venue.city ? ` · ${venue.city}` : ''}</>}
        right={!existing ? <button className="btn sm" onClick={cancel}>Abbrechen</button> : undefined}
      />

      <label className="field">
        <span>Wann?</span>
        <input className="input" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} max={toLocalInput(new Date(Date.now() + 86400000))} />
      </label>

      <div className="field">
        <span>Wie war's heute?</span>
        <RatingPicker value={rating} onChange={setRating} />
        {rating !== null && (
          <div className="switch" style={{ paddingBottom: 0 }}>
            <div className="s">Auch als Gesamtbewertung der Location übernehmen{venue.rating !== null ? ` (aktuell ${venue.rating})` : ''}</div>
            <Toggle label="Gesamtbewertung übernehmen" checked={updateOverall} onChange={setUpdateOverall} />
          </div>
        )}
      </div>

      <details className="card fold" style={{ marginBottom: 14 }}>
        <summary>🏷️ Tags & Preisklasse{tags.length ? ` · ${tags.length}` : ''}</summary>
        <div className="tag-group">
          <div className="gl">Preisklasse</div>
          <PricePicker value={price} onChange={setPrice} />
        </div>
        <div className="tag-group">
          <TagPicker value={tags} onChange={setTags} />
        </div>
        {hasFood && (
          <label className="field" style={{ margin: '12px 0 0' }}>
            <span>Was gibt es zu essen? (optional)</span>
            <input className="input" maxLength={300} value={foodNote} onChange={(e) => setFoodNote(e.target.value)} placeholder="z. B. Burger, Flammkuchen, Erdnüsse" />
          </label>
        )}
        <div className="small muted mt12">Tags und Preisklasse gelten für die Location, nicht nur für heute.</div>
      </details>

      <div className="field">
        <span>Getränke {totalDrinks > 0 && `· ${totalDrinks}`}</span>
        <div className="chips wrap">
          {usedDrinks.map((d) => {
            const c = drinks.find((x) => x.name === d)?.count;
            return (
              <button type="button" key={d} className={`chip ${c ? 'on' : ''}`} onClick={() => addDrink(d)}>
                {d}{c ? ` ×${c}` : ''}
              </button>
            );
          })}
        </div>
        {drinks.length > 0 && (
          <div className="card mt8" style={{ padding: '4px 14px' }}>
            {drinks.map((d) => (
              <div key={d.name} className="flex between" style={{ padding: '6px 0' }}>
                <span>{d.name}</span>
                <span className="stepper">
                  <button type="button" onClick={() => addDrink(d.name, -1)} aria-label={`${d.name} weniger`}>−</button>
                  <b style={{ minWidth: 18, textAlign: 'center' }}>{d.count}</b>
                  <button type="button" onClick={() => addDrink(d.name, 1)} aria-label={`${d.name} mehr`}>+</button>
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="row mt8">
          <input
            className="input" placeholder="Anderes Getränk" value={customDrink} maxLength={40}
            onChange={(e) => setCustomDrink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customDrink.trim()) {
                addDrink(customDrink.trim());
                setCustomDrink('');
              }
            }}
          />
          <button type="button" className="btn" style={{ flex: 'none' }} aria-label="Getränk hinzufügen" onClick={() => { if (customDrink.trim()) { addDrink(customDrink.trim()); setCustomDrink(''); } }}>+</button>
        </div>
        {totalDrinks >= 6 && <div className="small mt8" style={{ color: 'var(--warn)' }}>💧 Denk an ein Glas Wasser zwischendurch und komm sicher nach Hause.</div>}
      </div>

      <label className="field">
        <span>Ausgaben (€)</span>
        <input className="input" inputMode="decimal" placeholder="z. B. 24,50" value={spend} onChange={(e) => setSpend(e.target.value.replace(/[^0-9.,]/g, ''))} />
      </label>

      <div className="field">
        <span>Mit wem?</span>
        <div className="chips wrap">
          {[...new Set([...knownCompanions, ...companions])].map((n) => (
            <button type="button" key={n} className={`chip ${companions.includes(n) ? 'on' : ''}`} onClick={() => setCompanions((c) => (c.includes(n) ? c.filter((x) => x !== n) : [...c, n]))}>
              {n}
            </button>
          ))}
        </div>
        <div className="row mt8">
          <input className="input" placeholder="Name hinzufügen" value={companionInput} maxLength={40} onChange={(e) => setCompanionInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCompanion()} />
          <button type="button" className="btn" style={{ flex: 'none' }} aria-label="Begleitung hinzufügen" onClick={addCompanion}>+</button>
        </div>
        <div className="small muted mt8">Nur für dich sichtbar.</div>
      </div>

      <div className="field">
        <span>Fotos</span>
        <div className="photos">
          <button type="button" className="add-photo" onClick={() => selfieRef.current?.click()}>🤳<br />Selfie</button>
          <button type="button" className="add-photo" onClick={() => fileRef.current?.click()}>🖼️<br />Galerie</button>
          {photos.map((p) => (
            <div className="ph" key={p.id}>
              <PhotoImg id={p.id} />
              <button type="button" className="x" aria-label="Foto entfernen" onClick={() => deletePhoto(p.id)}>✕</button>
            </div>
          ))}
        </div>
        <input ref={selfieRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
        <div className="small muted mt8">Fotos sind privat. Standortdaten im Bild werden vor dem Speichern entfernt.</div>
      </div>

      <label className="field">
        <span>Notiz</span>
        <textarea className="input" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="Was war los? DJ, Spiel, Highlights …" />
      </label>

      {existing && <button className="btn danger block" onClick={remove}>Besuch löschen</button>}

      <div className="sticky-actions">
        <button className="btn primary block" onClick={save} disabled={saving}>
          {existing ? 'Speichern' : '🍻 Check-in speichern'}
        </button>
      </div>
    </div>
  );
}
