import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HBars, MonthCompare, RatingDistribution, SimpleBars } from '../../components/Charts';
import { Empty, PhotoImg, RatingBadge, RatingLegend } from '../../components/ui';
import { VenueRow } from '../../components/VenueRow';
import { APP } from '../../config/app';
import { useSession } from '../../data/session';
import { myVenues, useStore } from '../../data/store';
import { milestones } from '../../lib/achievements';
import { buildChart, DIMENSIONS, isLongLabelDimension, METRICS, type Dimension, type Metric } from '../../lib/chartBuilder';
import { fmtRating } from '../../lib/rating';
import { computeDashboard } from '../../lib/stats';
import { categoryInfo } from '../../lib/tags';
import { euro, fmtDate, MONTHS_LONG, relTime } from '../../lib/util';

function Delta({ cur, prev, label }: { cur: number; prev: number; label: string }) {
  if (!prev && !cur) return <div className="d">–</div>;
  const diff = cur - prev;
  return (
    <div className={`d ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>
      {diff > 0 ? '▲' : diff < 0 ? '▼' : '='} {Math.abs(diff)} ggü. {label}
    </div>
  );
}

const PRESETS = [
  { key: 'weeks', label: 'Wochen' },
  { key: 'months', label: 'Monate' },
  { key: 'weekday', label: 'Ausgehtag' },
  { key: 'hour', label: 'Uhrzeit' },
  { key: 'city', label: 'Städte' },
  { key: 'category', label: 'Arten' },
  { key: 'rating', label: 'Bewertungen' }
] as const;
type Preset = (typeof PRESETS)[number]['key'];

function Header({ name, right }: { name: string; right?: React.ReactNode }) {
  return (
    <div className="top">
      <div>
        <div className="sub">Servus {name} 👋</div>
        <h1 className="grad-text" style={{ fontSize: 30 }}>{APP.name}</h1>
      </div>
      <div className="flex">
        {right}
        <Link className="icon-btn" to="/profil" aria-label="Profil und Einstellungen" style={{ display: 'grid', placeItems: 'center' }}>⚙️</Link>
      </div>
    </div>
  );
}

function SyncNote() {
  const pending = useStore((s) => s.pending);
  if (!pending) return null;
  const online = typeof navigator === 'undefined' || navigator.onLine;
  return (
    <div className="sync-note" role="status" style={{ marginBottom: 10 }}>
      {online ? `${pending} Änderung(en) werden übertragen …` : `Offline: ${pending} Änderung(en) werden gesendet, sobald wieder Netz da ist.`}
    </div>
  );
}

export default function Dashboard() {
  const name = useSession((s) => s.profile?.displayName ?? '');
  const venues = useStore(myVenues);
  const visits = useStore((s) => s.visits);
  const photoCount = useStore((s) => s.photos.length);
  // Stichtag einmal je Aufruf der Seite festhalten, damit die Berechnungen stabil bleiben
  const [now] = useState(() => new Date());
  const years = useMemo(() => {
    const ys = new Set(visits.map((v) => new Date(v.visitedAt).getFullYear()));
    ys.add(now.getFullYear());
    return [...ys].sort((a, b) => b - a);
  }, [visits, now]);
  const [year, setYear] = useState(now.getFullYear());
  const [preset, setPreset] = useState<Preset>('weeks');
  const [metric, setMetric] = useState<Metric>('visits');
  const [dim, setDim] = useState<Dimension>('weekday');

  const d = useMemo(() => computeDashboard(venues, visits, year, now), [venues, visits, year, now]);
  const ms = useMemo(() => milestones(venues, visits, photoCount), [venues, visits, photoCount]);
  const yearVisits = useMemo(() => visits.filter((v) => new Date(v.visitedAt).getFullYear() === year), [visits, year]);
  const custom = useMemo(() => buildChart(yearVisits, venues, metric, dim), [yearVisits, venues, metric, dim]);
  const isCurrentYear = year === now.getFullYear();
  const reached = ms.reduce((a, m) => a + m.level, 0);
  const possible = ms.reduce((a, m) => a + m.levels, 0);
  const metricInfo = METRICS.find((m) => m.key === metric)!;

  if (!venues.length) {
    return (
      <div className="page">
        <Header name={name} />
        <SyncNote />
        <Empty emoji="🍹" title="Noch keine Locations">
          Tippe unten auf das Plus, um deinen ersten Abend einzutragen.
        </Empty>
      </div>
    );
  }

  return (
    <div className="page">
      <Header
        name={name}
        right={
          <select className="input" style={{ width: 92, padding: '8px 10px' }} value={year} onChange={(e) => setYear(+e.target.value)} aria-label="Jahr">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        }
      />
      <SyncNote />

      <div className="kpis">
        <div className="kpi hero">
          <div className="hero-row">
            <div>
              <div className="l">{isCurrentYear ? MONTHS_LONG[now.getMonth()] : `Jahr ${year}`}</div>
              <div className="v" style={{ fontSize: 40 }}>{isCurrentYear ? d.monthVisits : d.yearVisits}</div>
              <div className="d">Besuche {isCurrentYear ? 'diesen Monat' : 'im Jahr'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {isCurrentYear && <Delta cur={d.monthVisits} prev={d.prevMonthVisits} label="Vormonat" />}
              <div className="d">{euro(isCurrentYear ? d.spendMonth : d.spendYear)} ausgegeben</div>
              {d.streakWeeks > 1 && isCurrentYear && <div className="d">🔥 {d.streakWeeks} Wochen in Folge</div>}
            </div>
          </div>
        </div>
        <div className="kpi">
          <div className="l">Besuche {year}</div>
          <div className="v">{d.yearVisits}</div>
          <Delta cur={d.yearVisits} prev={d.prevYearVisitsToDate} label={isCurrentYear ? 'Vorjahr (bis heute)' : String(year - 1)} />
        </div>
        <div className="kpi">
          <div className="l">Neue Locations</div>
          <div className="v">{d.newVenuesYear}</div>
          <div className="d">{d.totalVenues} insgesamt</div>
        </div>
        <div className="kpi">
          <div className="l">Städte {year}</div>
          <div className="v">{d.citiesYear}</div>
          <div className="d">{d.totalCities} insgesamt</div>
        </div>
        <div className="kpi">
          <div className="l">Ø Bewertung</div>
          <div className="v flex" style={{ gap: 8 }}>
            {fmtRating(d.avgRating !== null ? Math.round(d.avgRating * 10) / 10 : null)}
            <RatingBadge value={d.avgRating !== null ? Math.round(d.avgRating) : null} size="sm" />
          </div>
          <div className="d">über alle Locations</div>
        </div>
      </div>

      <div className="section">
        <div className="section-h">
          <h2>❤️ Favoriten</h2>
          <Link to="/liste?filter=fav">Alle</Link>
        </div>
        {d.favorites.length ? (
          <div className="hscroll">
            {d.favorites.map((s) => (
              <Link to={`/location/${s.venue.id}`} className="fav" key={s.venue.id}>
                <div className="img">
                  {s.venue.coverPhotoId ? <PhotoImg id={s.venue.coverPhotoId} /> : <span style={{ fontSize: 34 }}>{categoryInfo(s.venue.category).emoji}</span>}
                  <RatingBadge value={s.venue.rating} size="sm" />
                </div>
                <div className="b">
                  <div className="n">{s.venue.name}</div>
                  <div className="m">{s.venue.city} · {s.count}×</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card small muted">Markiere Locations mit ❤️, damit sie hier erscheinen.</div>
        )}
      </div>

      <div className="section">
        <div className="section-h"><h2>📊 Auswertungen{preset === 'weeks' ? '' : ` ${year}`}</h2></div>
        <div className="seg" role="tablist">
          {PRESETS.map((p) => (
            <button key={p.key} className={preset === p.key ? 'on' : ''} onClick={() => setPreset(p.key)} role="tab" aria-selected={preset === p.key}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="card mt8">
          {preset === 'weeks' && (
            <>
              <div className="small muted">Besuche in den letzten zwölf Wochen (Wochenbeginn)</div>
              <SimpleBars data={d.perWeek} name="Besuche" labelEvery={2} />
            </>
          )}
          {preset === 'months' && (
            <>
              <div className="small muted" style={{ marginBottom: 4 }}>Besuche pro Monat im Vergleich zum Vorjahr</div>
              <MonthCompare data={d.perMonth} year={year} />
            </>
          )}
          {preset === 'weekday' && (
            <>
              <div className="small muted">
                Besuche nach Wochentag{d.topWeekday && <> · dein Ausgehtag: <b style={{ color: 'var(--text)' }}>{d.topWeekday}</b></>}
              </div>
              <SimpleBars data={d.perWeekday.map((x) => ({ label: x.label, value: x.visits }))} name="Besuche" />
            </>
          )}
          {preset === 'hour' && (
            <>
              <div className="small muted">Uhrzeit des Check-ins (18 bis 5 Uhr)</div>
              <SimpleBars data={d.perHour.map((x) => ({ label: x.label, value: x.visits }))} name="Check-ins" />
            </>
          )}
          {preset === 'category' &&
            (d.perCategory.length ? (
              <>
                <div className="small muted" style={{ marginBottom: 6 }}>Besuche nach Art der Location</div>
                <HBars data={d.perCategory.map((c) => ({ label: `${categoryInfo(c.name).emoji} ${categoryInfo(c.name).label}`, value: c.value }))} name="Besuche" />
              </>
            ) : (
              <div className="small muted">Keine Besuche in {year}.</div>
            ))}
          {preset === 'city' &&
            (d.perCity.length ? (
              <>
                <div className="small muted" style={{ marginBottom: 6 }}>Besuche nach Stadt</div>
                <HBars data={d.perCity.map((c) => ({ label: c.name || 'Ohne Stadt', value: c.visits }))} name="Besuche" />
              </>
            ) : (
              <div className="small muted">Keine Besuche in {year}.</div>
            ))}
          {preset === 'rating' && (
            <>
              <div className="small muted">Wie du deine Locations bewertest</div>
              <RatingDistribution data={d.ratingDist} />
              <RatingLegend />
            </>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-h"><h2>🛠️ Eigenes Diagramm {year}</h2></div>
        <div className="card">
          <div className="row">
            <label className="field" style={{ marginBottom: 8 }}>
              <span>Kennzahl</span>
              <select className="input" value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
                {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </label>
            <label className="field" style={{ marginBottom: 8 }}>
              <span>Gruppiert nach</span>
              <select className="input" value={dim} onChange={(e) => setDim(e.target.value as Dimension)}>
                {DIMENSIONS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </label>
          </div>
          {custom.some((c) => c.value > 0) ? (
            isLongLabelDimension(dim) ? (
              <HBars data={custom} unit={metricInfo.unit} name={metricInfo.label} />
            ) : (
              <SimpleBars data={custom} unit={metricInfo.unit} name={metricInfo.label} />
            )
          ) : (
            <div className="small muted">Für {year} gibt es dazu noch keine Daten.</div>
          )}
        </div>
      </div>

      {d.yearVisits > 0 && (
        <div className="section">
          <div className="card wrapped">
            <div className="small muted">✨ Dein Jahr {year}</div>
            <div className="kpis mt12" style={{ gap: 14 }}>
              <div><div className="big-num">{d.yearVisits}</div><div className="small muted">Abende</div></div>
              <div><div className="big-num">{d.newVenuesYear}</div><div className="small muted">neue Locations</div></div>
              <div><div className="big-num">{d.perCity.length}</div><div className="small muted">Städte</div></div>
              <div><div className="big-num" style={{ fontSize: 30 }}>{euro(d.spendYear)}</div><div className="small muted">ausgegeben</div></div>
            </div>
            <div className="small mt12" style={{ lineHeight: 1.7 }}>
              {d.mostVisited[0] && <>🏠 Stammlokal: <b>{d.mostVisited[0].venue.name}</b> ({d.mostVisited[0].count}×)<br /></>}
              {d.topDrink && <>🥤 Lieblingsgetränk: <b>{d.topDrink.name}</b><br /></>}
              {d.topWeekday && <>📅 Ausgehtag: <b>{d.topWeekday}</b><br /></>}
              {d.perCity[0] && <>🏙️ Top-Stadt: <b>{d.perCity[0].name}</b></>}
            </div>
          </div>
        </div>
      )}

      {d.topRated.length > 0 && (
        <div className="section">
          <div className="section-h">
            <h2>🏆 Am besten bewertet</h2>
            <Link to="/liste">Ranking</Link>
          </div>
          {d.topRated.slice(0, 3).map((s, i) => <VenueRow key={s.venue.id} s={s} rank={i + 1} />)}
        </div>
      )}
      {d.mostVisited.length > 0 && (
        <div className="section">
          <div className="section-h"><h2>🔁 Am häufigsten besucht</h2></div>
          {d.mostVisited.slice(0, 3).map((s, i) => <VenueRow key={s.venue.id} s={s} rank={i + 1} />)}
        </div>
      )}

      <div className="section">
        <div className="section-h">
          <h2>🎖️ Meilensteine</h2>
          <span className="small muted">{reached} von {possible} Stufen</span>
        </div>
        <div className="hscroll">
          {[...ms].sort((a, b) => Number(b.level > 0) - Number(a.level > 0)).map((m) => (
            <div key={m.id} className={`ach ${m.level > 0 ? '' : 'locked'}`}>
              <div className="e">{m.emoji}</div>
              <div className="t">{m.title}</div>
              <div className="lvl" aria-label={`Stufe ${m.level} von ${m.levels}`}>
                {Array.from({ length: m.levels }, (_, i) => <i key={i} className={i < m.level ? 'on' : ''} />)}
              </div>
              <div className="s">{m.desc}</div>
              <div className="bar"><i style={{ width: `${Math.min(100, (m.value / m.goal) * 100)}%` }} /></div>
              <div className="s" style={{ minHeight: 0, marginTop: 4 }}>{m.done ? 'Höchste Stufe erreicht' : `${Math.min(m.value, m.goal)} / ${m.goal}`}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-h"><h2>🕒 Zuletzt</h2></div>
        <div className="card" style={{ padding: '2px 14px' }}>
          {d.recent.map((v) => (
            <Link key={v.id} to={`/besuch/${v.id}`} className="feed-item" style={{ alignItems: 'center' }}>
              <span style={{ fontSize: 22 }}>{v.venue ? categoryInfo(v.venue.category).emoji : '📍'}</span>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{v.venue?.name ?? 'Unbekannte Location'}</div>
                <div className="small muted">{fmtDate(v.visitedAt, true)}{now.getTime() - new Date(v.visitedAt).getTime() < 7 * 86400000 ? ` · ${relTime(v.visitedAt)}` : ''}</div>
              </div>
              {typeof v.rating === 'number' && <RatingBadge value={v.rating} size="sm" />}
            </Link>
          ))}
          {!d.recent.length && <div className="small muted" style={{ padding: 12 }}>Noch keine Besuche.</div>}
        </div>
      </div>
      <p className="small muted center mt16">Trink verantwortungsvoll. Kein Alkohol am Steuer.</p>
    </div>
  );
}
