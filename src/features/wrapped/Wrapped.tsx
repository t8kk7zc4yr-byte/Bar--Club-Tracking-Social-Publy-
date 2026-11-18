import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Empty, Header } from '../../components/ui';
import { myVenues, useStore } from '../../data/store';
import { toast } from '../../lib/notify';
import { fmtRating } from '../../lib/rating';
import { computeDashboard, longestStreak } from '../../lib/stats';
import { categoryInfo } from '../../lib/tags';
import { groupByNight } from '../../lib/tours';
import { renderCard, type Card } from './storyCards';

const WEEKDAYS_LONG: Record<string, string> = { Mo: 'Montag', Di: 'Dienstag', Mi: 'Mittwoch', Do: 'Donnerstag', Fr: 'Freitag', Sa: 'Samstag', So: 'Sonntag' };

/** Jahresrückblick als Bildkarten im Story-Format, erzeugt auf dem Gerät */
export default function Wrapped() {
  const { year: y } = useParams();
  const year = Number(y) || new Date().getFullYear();
  const venues = useStore(myVenues);
  const visits = useStore((s) => s.visits);
  const [images, setImages] = useState<{ blob: Blob; url: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const cards = useMemo<Card[]>(() => {
    const yearVisits = visits.filter((v) => new Date(v.visitedAt).getFullYear() === year);
    if (!yearVisits.length) return [];
    const d = computeDashboard(venues, visits, year);
    const nights = groupByNight(yearVisits);
    const topTour = Math.max(0, ...[...nights.values()].map((l) => new Set(l.map((v) => v.venueId)).size));
    const topCat = d.perCategory[0] ? categoryInfo(d.perCategory[0].name) : null;
    const best = d.topRated[0];
    const stamm = d.mostVisited[0];
    return [
      {
        kicker: `Mein Jahr ${year}`,
        big: String(nights.size),
        bigLabel: nights.size === 1 ? 'Abend unterwegs' : 'Abende unterwegs',
        lines: [
          { emoji: '📍', label: 'Neue Locations', value: String(d.newVenuesYear) },
          { emoji: '🏙️', label: d.perCity.length === 1 ? 'Stadt' : 'Städte', value: d.perCity.slice(0, 3).map((c) => c.name).join(', ') + (d.perCity.length > 3 ? ` +${d.perCity.length - 3}` : '') || '–' },
          { emoji: '🔥', label: 'Längste Serie', value: `${longestStreak(yearVisits)} Wochen in Folge` }
        ]
      },
      {
        kicker: 'Meine Lieblingsorte',
        big: stamm ? stamm.venue.name : '–',
        bigLabel: stamm ? `Stammlokal · ${stamm.count}× besucht` : 'Stammlokal',
        lines: [
          ...(best ? [{ emoji: '🏆', label: 'Am besten bewertet', value: `${best.venue.name} (${fmtRating(best.venue.rating)}/10)` }] : []),
          ...(topCat ? [{ emoji: topCat.emoji, label: 'Lieblingsart', value: topCat.label }] : []),
          { emoji: '⭐', label: 'Ø Bewertung', value: d.avgRating !== null ? `${fmtRating(Math.round(d.avgRating * 10) / 10)} von 10` : '–' }
        ]
      },
      {
        kicker: 'So gehe ich aus',
        big: d.topWeekday ? WEEKDAYS_LONG[d.topWeekday] ?? d.topWeekday : '–',
        bigLabel: 'mein Ausgehtag',
        lines: [
          { emoji: '🚶', label: 'Größte Tour', value: topTour > 1 ? `${topTour} Locations an einem Abend` : 'eine Location pro Abend' },
          { emoji: '🕘', label: 'Typische Uhrzeit', value: (() => {
            const h = [...d.perHour].sort((a, b) => b.visits - a.visits)[0];
            return h && h.visits ? `ab ${h.label} Uhr` : '–';
          })() },
          { emoji: '📅', label: 'Aktivster Monat', value: (() => {
            const m = [...d.perMonth].sort((a, b) => b.visits - a.visits)[0];
            return m && m.visits ? `${m.label} (${m.visits} Besuche)` : '–';
          })() }
        ]
      }
    ];
  }, [venues, visits, year]);

  useEffect(() => {
    let live = true;
    const urls: string[] = [];
    (async () => {
      const out: { blob: Blob; url: string }[] = [];
      for (let i = 0; i < cards.length; i++) {
        const blob = await renderCard(cards[i], i, cards.length);
        const url = URL.createObjectURL(blob);
        urls.push(url);
        out.push({ blob, url });
      }
      if (live) setImages(out);
    })().catch(() => toast('Die Karten konnten nicht erzeugt werden'));
    return () => {
      live = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [cards]);

  const files = () => images.map((img, i) => new File([img.blob], `jahresrueckblick-${year}-${i + 1}.png`, { type: 'image/png' }));

  const share = async () => {
    setBusy(true);
    try {
      const f = files();
      if (navigator.canShare?.({ files: f })) {
        await navigator.share({ files: f, title: `Mein Jahr ${year}` });
      } else {
        for (const file of f) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(file);
          a.download = file.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        }
        toast('Bilder gespeichert');
      }
    } catch {
      /* abgebrochen */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page no-tabbar">
      <Header back title={`Jahresrückblick ${year}`} sub="Zum Teilen in Stories oder Chats" />
      {!cards.length ? (
        <Empty emoji="✨" title={`Keine Besuche in ${year}`}>Sobald du Abende einträgst, entsteht hier dein Rückblick.</Empty>
      ) : (
        <>
          <div className="story-strip">
            {images.map((img, i) => <img key={i} src={img.url} alt={`Rückblick-Karte ${i + 1} von ${images.length}`} />)}
            {!images.length && <div className="small muted">Karten werden erstellt …</div>}
          </div>
          <button className="btn primary block mt16" disabled={busy || !images.length} onClick={share}>📤 Teilen oder speichern</button>
          <p className="small muted mt8">
            Die Bilder entstehen nur auf deinem Gerät. Ausgaben und Getränke sind bewusst nicht enthalten.
          </p>
        </>
      )}
    </div>
  );
}
