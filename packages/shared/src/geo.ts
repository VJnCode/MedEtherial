import type { LatLng } from './schemas.js';

const R = 6371e3;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Initial bearing in degrees from a to b. */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

/** GeoJSON uses [lng, lat]. */
export const toPoint = (p: LatLng): GeoPoint => ({ type: 'Point', coordinates: [p.lng, p.lat] });
export const fromPoint = (p: { coordinates: number[] }): LatLng => ({
  lat: p.coordinates[1] ?? 0,
  lng: p.coordinates[0] ?? 0,
});

/** Default map centre — Mysuru, Karnataka. */
export const DEFAULT_CENTER: LatLng = { lat: 12.2958, lng: 76.6394 };
