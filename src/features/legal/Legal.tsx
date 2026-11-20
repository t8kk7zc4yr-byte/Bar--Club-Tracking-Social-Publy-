import { Fragment, type ReactNode } from 'react';
import { Header } from '../../components/ui';
import datenschutz from '../../legal/datenschutz.md?raw';
import impressum from '../../legal/impressum.md?raw';

/**
 * Rechtstexte. Quelle sind die Markdown-Dateien in src/legal/ (dieselben Dateien dienen als Vorlage zum Bearbeiten).
 * Platzhalter in doppelten eckigen Klammern [[ ]] werden gelb hervorgehoben; solange es welche gibt, gilt der Text als Entwurf.
 */
const TEXTS = { datenschutz, impressum } as const;

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\]|\[[^\]]+\]\(https?:\/\/[^)]+\))/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <b key={i}>{p.slice(2, -2)}</b>;
    if (p.startsWith('[[') && p.endsWith(']]')) return <span key={i} className="ph">{p.slice(2, -2)}</span>;
    const link = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(p);
    if (link) return <a key={i} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

/** Kleiner Markdown-Leser für Überschriften, Absätze und Aufzählungen */
function render(md: string): ReactNode[] {
  return md
    .trim()
    .split(/\n\s*\n/)
    .map((block, i) => {
      const lines = block.split('\n');
      if (lines[0].startsWith('## ')) return <h2 key={i}>{inline(lines[0].slice(3))}</h2>;
      if (lines.every((l) => l.startsWith('* '))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>;
      return <p key={i}>{inline(lines.join(' '))}</p>;
    });
}

export const openPoints = (doc: keyof typeof TEXTS) => (TEXTS[doc].match(/\[\[/g) ?? []).length;

export default function Legal({ doc }: { doc: keyof typeof TEXTS }) {
  const open = openPoints(doc);
  return (
    <div className="page no-tabbar legal-body">
      <Header back title={doc === 'datenschutz' ? 'Datenschutzhinweise' : 'Impressum'} />
      {open > 0 && (
        <div className="draft-banner">
          <b>Entwurf für den internen Test.</b> Der Text ist nicht rechtlich geprüft; {open} gelb markierte {open === 1 ? 'Angabe fehlt' : 'Angaben fehlen'} noch.
        </div>
      )}
      {render(TEXTS[doc])}
    </div>
  );
}
