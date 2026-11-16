import L from 'leaflet';
import { useEffect } from 'react';
import { TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { fmtRating, tierFor } from '../lib/rating';

export function Tiles() {
  return (
    <TileLayer
      className="dark-tiles"
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      maxZoom={19}
    />
  );
}

interface PinInfo {
  rating: number | null;
  wishlist: boolean;
  favorite: boolean;
}

const iconCache = new Map<string, L.DivIcon>();
export function venueIcon(v: PinInfo): L.DivIcon {
  const t = tierFor(v.rating);
  const key = `${v.wishlist}-${v.rating}-${v.favorite}`;
  if (iconCache.has(key)) return iconCache.get(key)!;
  const bg = v.wishlist ? '' : t.key === 'top' ? 'background:linear-gradient(135deg,#ffe17a,#f5b301 50%,#d18b00)' : `background:${t.color}`;
  const label = v.wishlist ? '📌' : v.favorite && v.rating === null ? '❤' : fmtRating(v.rating);
  const icon = L.divIcon({
    className: '',
    html: `<div class="pin ${v.wishlist ? 'wish' : ''}" style="${bg};color:${t.text}"><b>${label}</b></div>`,
    iconSize: [34, 34],
    iconAnchor: [3, 34],
    popupAnchor: [14, -30]
  });
  iconCache.set(key, icon);
  return icon;
}

export const meIcon = L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

export function FlyTo({ target, zoom = 15 }: { target: [number, number] | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, zoom, { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.[0], target?.[1]]);
  return null;
}

export function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) });
  return null;
}
