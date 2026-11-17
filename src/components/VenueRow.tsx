import { Link } from 'react-router-dom';
import type { VenueView } from '../data/store';
import { categoryInfo, fmtPrice, SPORT_TAGS } from '../lib/tags';
import { fmtDistance, relTime } from '../lib/util';
import type { VenueStats } from '../lib/venueStats';
import { PhotoImg, RatingBadge } from './ui';

export function VenueRow({ s, rank, distance }: { s: VenueStats<VenueView>; rank?: number; distance?: number }) {
  const v = s.venue;
  const cat = categoryInfo(v.category);
  const meta = [`${cat.emoji} ${cat.label}`, v.city, distance !== undefined ? fmtDistance(distance) : null, fmtPrice(v.priceLevel) || null].filter(Boolean);
  return (
    <Link to={`/location/${v.id}`} className="vrow">
      {rank !== undefined && <span className={`rank p${rank}`}>{rank}</span>}
      {v.coverPhotoId ? (
        <PhotoImg id={v.coverPhotoId} className="thumb" />
      ) : (
        <span className="thumb" style={{ display: 'grid', placeItems: 'center', fontSize: 24 }}>{cat.emoji}</span>
      )}
      <div className="main">
        <div className="name">
          {v.favorite && '❤️ '}
          {v.wishlist && '📌 '}
          {v.name}
        </div>
        <div className="meta">{meta.join(' · ')}</div>
        <div className="meta">
          {v.wishlist ? 'Auf der Wunschliste' : s.count ? `${s.count}× besucht · zuletzt ${relTime(s.lastVisit!)}` : 'Noch kein Besuch eingetragen'}
          {v.tags.some((t) => SPORT_TAGS.includes(t)) && ' · ⚽'}
        </div>
      </div>
      <RatingBadge value={v.rating} />
    </Link>
  );
}
