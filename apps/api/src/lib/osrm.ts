import { haversine, type LatLng } from '@medetherial/shared';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export interface RouteResult {
  /** [lat, lng] pairs */
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  source: 'osrm' | 'fallback';
}

/** Average urban ambulance speed used when OSRM is unreachable (≈ 40 km/h). */
const FALLBACK_SPEED_MS = 11;
/** Road distance is typically ~1.3x straight-line distance in cities. */
const DETOUR_FACTOR = 1.3;

function fallbackRoute(from: LatLng, to: LatLng): RouteResult {
  const steps = 20;
  const coordinates: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    coordinates.push([from.lat + (to.lat - from.lat) * t, from.lng + (to.lng - from.lng) * t]);
  }
  const distanceMeters = haversine(from, to) * DETOUR_FACTOR;
  return { coordinates, distanceMeters, durationSeconds: distanceMeters / FALLBACK_SPEED_MS, source: 'fallback' };
}

/**
 * Fetches a driving route from an OSRM server (open-source routing engine on OpenStreetMap data).
 * Never throws: degrades to a straight-line estimate so dispatch is never blocked by routing.
 */
export async function getRoute(from: LatLng, to: LatLng, timeoutMs = 4000): Promise<RouteResult> {
  if (env.NODE_ENV === 'test') return fallbackRoute(from, to);
  const url = `${env.OSRM_URL}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'MedEtherial/1.0' },
    });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const body = (await res.json()) as {
      code: string;
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    };
    const route = body.routes?.[0];
    if (body.code !== 'Ok' || !route) throw new Error(`OSRM code ${body.code}`);
    return {
      coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceMeters: route.distance,
      // Emergency vehicles move faster than OSRM's civilian estimate.
      durationSeconds: route.duration * 0.8,
      source: 'osrm',
    };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'OSRM unavailable, using straight-line fallback');
    return fallbackRoute(from, to);
  }
}

/** Remaining distance along a polyline from the closest vertex to the current position. */
export function remainingAlongRoute(route: [number, number][], pos: LatLng): number {
  if (route.length === 0) return 0;
  let best = 0;
  let bestD = Infinity;
  route.forEach(([lat, lng], i) => {
    const d = haversine(pos, { lat, lng });
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  let total = bestD;
  for (let i = best; i < route.length - 1; i++) {
    const a = route[i]!;
    const b = route[i + 1]!;
    total += haversine({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] });
  }
  return total;
}

export function estimateEta(remainingMeters: number, speedMs?: number): number {
  const v = speedMs && speedMs > 3 ? speedMs : FALLBACK_SPEED_MS;
  return Math.round(remainingMeters / v);
}
