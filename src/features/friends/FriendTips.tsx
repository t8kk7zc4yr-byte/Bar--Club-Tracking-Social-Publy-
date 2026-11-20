import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, RatingBadge } from '../../components/ui';
import { friendSummaries, useSocial } from '../../data/social';
import { adoptVenue, myVenues, useStore } from '../../data/store';
import { toast } from '../../lib/notify';
import { fmtRating } from '../../lib/rating';
import { categoryInfo, SPORT_TAGS, tagInfo } from '../../lib/tags';

type Mode = 'top' | 'sport' | 'wish';

/** Tipps aus dem Freundeskreis: gut bewertete Locations, Live-Sport und gemeinsame Wunschliste */
export default function FriendTips() {
  const nav = useNavigate();
  const summaries = useSocial(friendSummaries);
  const venues = useSocial((s) => s.friendVenues);
  const mine = useStore(myVenues);
  const visits = useStore((s) => s.visits);
  const [mode, setMode] = useState<Mode>('top');

  const visited = useMemo(() => new Set(visits.map((v) => v.venueId)), [visits]);
  const myWish = useMemo(() => new Set(mine.filter((v) => v.wishlist).map((v) => v.id)), [mine]);

  const list = useMemo(() => {
    const all = [...summaries.values()].filter((s) => venues[s.venueId]);
    if (mode === 'top') return all.filter((s) => s.avg !== null && s.avg >= 7 && !visited.has(s.venueId)).sort((a, b) => b.avg! - a.avg! || b.entries.length - a.entries.length);
    if (mode === 'sport') return all.filter((s) => s.tags.some((t) => SPORT_TAGS.includes(t))).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
    return all.filter((s) => myWish.has(s.venueId) && s.entries.some((e) => e.wishlist));
  }, [summaries, venues, mode, visited, myWish]);

  if (!summaries.size) return null;

  const open = async (id: string) => {
    await adoptVenue(venues[id], null);
    nav(`/location/${id}`);
  };
  const remember = async (id: string) => {
    await adoptVenue(venues[id], { wishlist: true });
    toast('📌 Auf deiner Wunschliste');
  };

  return (
    <div className="section">
      <div className="section-h"><h2>💡 Tipps von Freunden</h2></div>
      <div className="chips">
        {([['top', '⭐ Gut bewertet'], ['sport', '⚽ Hier läuft Sport'], ['wish', '📌 Gemeinsame Wunschliste']] as const).map(([k, l]) => (
          <button key={k} className={`chip ${mode === k ? 'on' : ''}`} aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>
        ))}
      </div>
      <div className="mt8">
        {list.slice(0, 15).map((s) => {
          const v = venues[s.venueId];
          const cat = categoryInfo(v.category);
          const sport = s.tags.filter((t) => SPORT_TAGS.includes(t)).map((t) => tagInfo(t)?.label).filter(Boolean);
          return (
            <div className="vrow" key={s.venueId} style={{ cursor: 'pointer' }} onClick={() => open(s.venueId)}>
              <span className="thumb" style={{ display: 'grid', placeItems: 'center', fontSize: 24 }}>{cat.emoji}</span>
              <div className="main">
                <div className="name">{v.name}</div>
                <div className="meta">{[cat.label, v.city].filter(Boolean).join(' · ')}</div>
                <div className="meta flex" style={{ gap: 4 }}>
                  {s.entries.slice(0, 4).map((e) => <Avatar key={e.userId} name={e.name} color={e.color} size="sm" />)}
                  <span>
                    {s.entries.length === 1 ? s.entries[0].name : `${s.entries.length} Freunde`}
                    {s.avg !== null ? ` · Ø ${fmtRating(Math.round(s.avg * 10) / 10)}` : ''}
                    {mode === 'sport' && sport.length ? ` · ${sport.join(', ')}` : ''}
                  </span>
                </div>
              </div>
              {mode !== 'wish' && !myWish.has(s.venueId) && !visited.has(s.venueId) ? (
                <button className="btn sm" onClick={(e) => { e.stopPropagation(); remember(s.venueId); }} aria-label={`${v.name} auf die Wunschliste`}>📌</button>
              ) : (
                <RatingBadge value={s.avg !== null ? Math.round(s.avg) : null} size="sm" />
              )}
            </div>
          );
        })}
        {!list.length && (
          <div className="card small muted">
            {mode === 'top' && 'Noch keine Tipps: Hier erscheinen Locations, die deine Freunde mit 7 oder besser bewertet haben und in denen du noch nicht warst.'}
            {mode === 'sport' && 'Noch keine Location, die deine Freunde mit Live-Sport getaggt haben.'}
            {mode === 'wish' && 'Keine Location steht gleichzeitig auf deiner und der Wunschliste eines Freundes.'}
          </div>
        )}
      </div>
    </div>
  );
}

/** Kurzfassung für die Location-Seite */
export function FriendsOnVenue({ venueId }: { venueId: string }) {
  const summary = useSocial((s) => friendSummaries(s).get(venueId));
  if (!summary) return null;
  return (
    <div className="section">
      <div className="section-h">
        <h2>👥 Bewertungen deiner Freunde</h2>
        {summary.avg !== null && <span className="small muted">Ø {fmtRating(Math.round(summary.avg * 10) / 10)}</span>}
      </div>
      <div className="card" style={{ padding: '2px 14px' }}>
        {summary.entries.map((e) => (
          <div className="feed-item" key={e.userId} style={{ alignItems: 'center' }}>
            <Avatar name={e.name} color={e.color} size="sm" />
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{e.name}{e.favorite ? ' ❤️' : ''}</div>
              <div className="small muted">
                {e.wishlist && e.rating === null ? 'Auf der Wunschliste' : e.tags.map((t) => tagInfo(t)?.label).filter(Boolean).slice(0, 4).join(' · ') || 'war hier'}
              </div>
            </div>
            <RatingBadge value={e.rating} size="sm" />
          </div>
        ))}
      </div>
      <div className="small muted mt8">Persönliche Einschätzungen deiner Freunde, keine Bewertung durch Social Publy.</div>
    </div>
  );
}

