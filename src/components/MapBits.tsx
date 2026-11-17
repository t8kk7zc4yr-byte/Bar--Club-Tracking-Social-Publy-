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

export function FitBounds({ points, padding = 40 }: { points: [number, number][]; padding?: number }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(L.latLngBounds(points), { padding: [padding, padding], paddingTopLeft: [padding, padding + 70], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

export function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onZoom(map.getZoom()), []);
  return null;
}

/** Blase für mehrere nah beieinander liegende Locations */
export function clusterIcon(count: number, avg: number | null): L.DivIcon {
  const t = tierFor(avg === null ? null : Math.round(avg));
  const size = Math.min(64, 38 + count * 2);
  return L.divIcon({
    className: '',
    html: `<div class="city-bubble" style="width:${size}px;height:${size}px;border-color:${t.color}"><b>${count}</b></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

/** Zoomt auf eine Liste von Punkten, z. B. nach Tipp auf eine Blase */
export function useFit() {
  const map = useMap();
  return (points: [number, number][]) => map.fitBounds(L.latLngBounds(points), { padding: [60, 60], paddingTopLeft: [40, 120], maxZoom: 17 });
}
