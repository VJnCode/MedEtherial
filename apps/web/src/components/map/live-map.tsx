'use client';

import type { LatLng } from '@medetherial/shared';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from 'next-themes';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';

export type MarkerKind = 'ambulance' | 'incident' | 'hospital' | 'me';

export interface MapMarker {
  id: string;
  kind: MarkerKind;
  position: LatLng;
  label?: string;
  sublabel?: string;
  /** Visual tone: status for ambulances, severity for incidents. */
  tone?: 'available' | 'busy' | 'offline' | 'critical' | 'high' | 'moderate' | 'low';
  heading?: number;
  live?: boolean;
  onClick?: () => void;
}

export interface MapRoute {
  id: string;
  positions: [number, number][];
  dashed?: boolean;
}

export interface LiveMapProps {
  center: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  routes?: MapRoute[];
  fitTo?: LatLng[];
  onMapClick?: (p: LatLng) => void;
  className?: string;
}

/**
 * OpenStreetMap raster tiles by default (no API key). For high-traffic production use,
 * point NEXT_PUBLIC_MAP_TILE_URL at a self-hosted or commercial tile server.
 * Without a dedicated dark tile URL, dark mode is derived from the light tiles via a CSS filter.
 */
const TILE_LIGHT = process.env.NEXT_PUBLIC_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_DARK = process.env.NEXT_PUBLIC_MAP_TILE_URL_DARK;
const ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ?? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const TONE_COLORS: Record<NonNullable<MapMarker['tone']>, string> = {
  available: '#16a34a',
  busy: '#f59e0b',
  offline: '#94a3b8',
  critical: '#dc2626',
  high: '#f97316',
  moderate: '#3b82f6',
  low: '#64748b',
};

function iconFor(m: MapMarker) {
  const color = m.tone ? TONE_COLORS[m.tone] : '#0f9a9a';
  let html = '';
  if (m.kind === 'ambulance') {
    html = `<div style="position:relative;width:34px;height:34px">
      <div style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:.25" class="${m.live ? 'me-pulse' : ''}"></div>
      <div style="position:absolute;inset:4px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);display:grid;place-items:center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10H6"/><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.502l-1.539-3.076A1 1 0 0 0 16.382 8H14"/><path d="M8 8v4"/><path d="M9 18h6"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
      </div>
      ${m.heading !== undefined ? `<div style="position:absolute;left:50%;top:-5px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:7px solid ${color};transform:translateX(-50%) rotate(${m.heading}deg);transform-origin:50% 22px"></div>` : ''}
    </div>`;
    return L.divIcon({ html, className: `me-marker${m.live ? ' me-marker-live' : ''}`, iconSize: [34, 34], iconAnchor: [17, 17] });
  }
  if (m.kind === 'hospital') {
    html = `<div style="width:30px;height:30px;border-radius:8px;background:#0e7490;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);display:grid;place-items:center;color:white;font-weight:800;font-size:16px;font-family:system-ui">H</div>`;
    return L.divIcon({ html, className: 'me-marker', iconSize: [30, 30], iconAnchor: [15, 15] });
  }
  if (m.kind === 'me') {
    html = `<div style="position:relative;width:22px;height:22px"><div class="me-pulse" style="position:absolute;inset:0;border-radius:9999px;background:#2563eb;opacity:.35"></div><div style="position:absolute;inset:4px;border-radius:9999px;background:#2563eb;border:2px solid white"></div></div>`;
    return L.divIcon({ html, className: 'me-marker', iconSize: [22, 22], iconAnchor: [11, 11] });
  }
  html = `<div style="position:relative;width:30px;height:40px">
    <svg width="30" height="40" viewBox="0 0 30 40"><path d="M15 0C6.7 0 0 6.6 0 14.8 0 26 15 40 15 40s15-14 15-25.2C30 6.6 23.3 0 15 0z" fill="${color}" stroke="white" stroke-width="2"/><circle cx="15" cy="15" r="5.5" fill="white"/></svg>
  </div>`;
  return L.divIcon({ html, className: 'me-marker', iconSize: [30, 40], iconAnchor: [15, 40], popupAnchor: [0, -36] });
}

function FitBounds({ points }: { points?: LatLng[] }) {
  const map = useMap();
  const key = points?.map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`).join('|');
  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) map.setView([points[0]!.lat, points[0]!.lng], Math.max(map.getZoom(), 14));
    else map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 15 });
    // Only refit when the set of points changes meaningfully.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function ClickHandler({ onClick }: { onClick?: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Recalculates size when the container is resized (sheets, tabs, layout shifts). */
function ResizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export default function LiveMap({ center, zoom = 13, markers = [], routes = [], fitTo, onMapClick, className }: LiveMapProps) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const icons = useMemo(
    () => new Map(markers.map((m) => [m.id, iconFor(m)])),
    // icon identity only needs to change when the visual inputs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markers.map((m) => `${m.id}:${m.kind}:${m.tone}:${Math.round((m.heading ?? -1) / 15)}:${m.live}`).join('|')],
  );

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      scrollWheelZoom
      className={`${className ?? 'h-full w-full'}${dark && !TILE_DARK ? ' me-dark-tiles' : ''}`}
      aria-label="Live map"
    >
      <TileLayer key={dark ? 'dark' : 'light'} url={dark && TILE_DARK ? TILE_DARK : TILE_LIGHT} attribution={ATTRIBUTION} maxZoom={19} />
      {routes.map((r) => (
        <Polyline
          key={r.id}
          positions={r.positions}
          pathOptions={{ color: dark ? '#5eead4' : '#0f766e', weight: 5, opacity: 0.85, dashArray: r.dashed ? '8 10' : undefined }}
        />
      ))}
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.position.lat, m.position.lng]}
          icon={icons.get(m.id)!}
          eventHandlers={m.onClick ? { click: m.onClick } : undefined}
          zIndexOffset={m.kind === 'ambulance' ? 1000 : 0}
        >
          {(m.label || m.sublabel) && (
            <Popup>
              <div className="space-y-0.5">
                {m.label && <p className="m-0! font-semibold">{m.label}</p>}
                {m.sublabel && <p className="m-0! text-xs opacity-75">{m.sublabel}</p>}
              </div>
            </Popup>
          )}
        </Marker>
      ))}
      <FitBounds points={fitTo} />
      <ClickHandler onClick={onMapClick} />
      <ResizeWatcher />
    </MapContainer>
  );
}
