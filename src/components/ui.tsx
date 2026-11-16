import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtRating, tierFor, TIERS } from '../lib/rating';
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
