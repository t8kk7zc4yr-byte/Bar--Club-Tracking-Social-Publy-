import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtRating, RATING_VALUES, tierFor, TIERS } from '../lib/rating';
import { photoUrl } from '../data/store';
import { PRICE_LEVELS, TAG_GROUPS, tagInfo, type TagId } from '../lib/tags';
import { onToast } from '../lib/notify';

export function RatingBadge({ value, size }: { value: number | null | undefined; size?: 'sm' | 'lg' }) {
  const t = tierFor(value);
  return (
    <span
      className={`rbadge ${size ?? ''} ${t.key === 'top' ? 'top' : ''}`}
      style={{ background: t.key === 'top' ? undefined : t.color, color: t.text }}
      title={t.label}
      aria-label={`Bewertung ${fmtRating(value)} von 10`}
    >
      {fmtRating(value)}
    </span>
  );
}

export function RatingLegend() {
  return (
    <div className="legend">
      {(['bad', 'ok', 'good', 'top'] as const).map((k) => (
        <span key={k}>
          <i
            style={{
              background: k === 'top' ? 'linear-gradient(135deg,#ffe17a,#f5b301 50%,#b87800)' : TIERS[k].color,
              boxShadow: k === 'top' ? '0 0 6px #f5b301aa' : undefined
            }}
          />
          {TIERS[k].label}
        </span>
      ))}
    </div>
  );
}

export function Header({ title, sub, right, back }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; back?: boolean }) {
  const nav = useNavigate();
  return (
    <div className="top">
      <div className="title-row">
        {back && (
          <button className="back-btn" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} aria-label="Zurück">
            ‹
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <h1>{title}</h1>
          {sub && <div className="sub">{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggle" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

export function Toasts() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: number | undefined;
    const off = onToast((m) => {
      setMsg(m);
      clearTimeout(t);
      t = window.setTimeout(() => setMsg(null), 3500);
    });
    return () => {
      off();
      clearTimeout(t);
    };
  }, []);
  if (!msg) return null;
  return (
    <div className="toast" role="status" onClick={() => setMsg(null)}>
      {msg}
    </div>
  );
}

export function Empty({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="e">{emoji}</div>
      <div style={{ fontWeight: 650, color: 'var(--text)' }}>{title}</div>
      {children && <div className="small mt8">{children}</div>}
    </div>
  );
}

export function Avatar({ name, color, size }: { name: string; color: string; size?: 'sm' }) {
  return (
    <span className={`avatar ${size ?? ''}`} style={{ background: color }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function RatingPicker({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <div>
      <div className="rpicker" role="radiogroup" aria-label="Bewertung 1 bis 10">
        {RATING_VALUES.map((i) => {
          const t = tierFor(i);
          const on = value === i;
          return (
            <button
              type="button"
              key={i}
              role="radio"
              aria-checked={on}
              aria-label={`Bewertung ${i}`}
              onClick={() => onChange(on ? null : i)}
              style={on ? { background: t.color, color: t.text, borderColor: t.color, transform: 'scale(1.08)' } : { color: t.color }}
            >
              {i}
            </button>
          );
        })}
      </div>
      <div className="rpicker-legend">
        <span>1 = katastrophal</span>
        <span>{value !== null && value !== undefined ? tierFor(value).label : 'Tippen zum Bewerten'}</span>
        <span>10 = legendär</span>
      </div>
    </div>
  );
}

export function TagPicker({ value, onChange }: { value: TagId[]; onChange: (v: TagId[]) => void }) {
  const toggle = (id: TagId) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div>
      {TAG_GROUPS.map((g) => (
        <div className="tag-group" key={g.id}>
          <div className="gl">{g.label}</div>
          <div className="chips wrap">
            {g.tags.map((t) => (
              <button type="button" key={t.id} className={`chip ${value.includes(t.id) ? 'on' : ''}`} aria-pressed={value.includes(t.id)} onClick={() => toggle(t.id)}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PricePicker({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <div className="chips">
      {PRICE_LEVELS.map((p) => (
        <button type="button" key={p} className={`chip ${value === p ? 'on' : ''}`} aria-pressed={value === p} onClick={() => onChange(value === p ? null : p)}>
          {'€'.repeat(p)}
        </button>
      ))}
    </div>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="tags">
      {tags.map((id) => {
        const t = tagInfo(id);
        return t ? <span className="tag" key={id}>{t.emoji} {t.label}</span> : null;
      })}
    </div>
  );
}

export function PhotoImg({ id, alt = '', className, onClick }: { id: string; alt?: string; className?: string; onClick?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    photoUrl(id).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [id]);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} onClick={onClick} loading="lazy" />;
}
