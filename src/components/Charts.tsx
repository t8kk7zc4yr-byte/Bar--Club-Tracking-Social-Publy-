import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { tierFor } from '../lib/rating';

// Farben über CSS-Variablen, damit die Diagramme im hellen und dunklen Modus passen
const ACCENT = 'var(--accent)';
const PREV = 'var(--dim)';
const tooltipStyle = {
  contentStyle: { background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--text)', fontSize: 13 },
  labelStyle: { color: 'var(--muted)' },
  itemStyle: { color: 'var(--text)' },
  cursor: { fill: 'var(--line)', opacity: 0.4 }
};

type Row = { label: string; value: number };

export function SimpleBars({ data, unit, color = ACCENT, height = 190, name = 'Wert', labelEvery = 1 }: { data: Row[]; unit?: string; color?: string; height?: number; name?: string; labelEvery?: number }) {
  const many = data.length > 8;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }} barCategoryGap={many ? '18%' : '28%'}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={labelEvery - 1} tick={{ fontSize: many ? 9.5 : 11 }} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
        <Tooltip {...tooltipStyle} formatter={(v) => [`${v}${unit ? ' ' + unit : ''}`, name]} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Waagerecht für lange Bezeichnungen (Städte, Locations) */
export function HBars({ data, unit, name = 'Wert' }: { data: Row[]; unit?: string; name?: string }) {
  const h = Math.max(120, data.length * 34 + 20);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }} barCategoryGap="22%">
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={118} tick={{ fontSize: 12, fill: 'var(--text)' }} />
        <Tooltip {...tooltipStyle} formatter={(v) => [`${v}${unit ? ' ' + unit : ''}`, name]} />
        <Bar dataKey="value" fill={ACCENT} radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: 'right', fill: 'var(--muted)', fontSize: 11 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthCompare({ data, year }: { data: { label: string; visits: number; prev: number }[]; year: number }) {
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }} barGap={2} barCategoryGap="18%">
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 9.5 }} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
        <Tooltip {...tooltipStyle} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
        <Bar dataKey="prev" name={String(year - 1)} fill={PREV} radius={[4, 4, 0, 0]} maxBarSize={14} />
        <Bar dataKey="visits" name={String(year)} fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Verteilung der Bewertungen 1 bis 10 in den Farben der Skala */
export function RatingDistribution({ data }: { data: { label: string; count: number; rating: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }} barCategoryGap="16%">
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
        <Tooltip {...tooltipStyle} formatter={(v) => [`${v} Locations`, 'Anzahl']} labelFormatter={(l) => `Bewertung ${l}`} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.label} fill={tierFor(d.rating).color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
