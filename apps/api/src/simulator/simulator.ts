import { DEFAULT_CENTER, bearing, haversine, type IncidentStatus, type LatLng } from '@medetherial/shared';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { Ambulance, Incident } from '../models/index.js';
import { createIncident, ingestLocation, transitionIncident } from '../services/dispatch.service.js';

/**
 * Demo simulator: drives `simulated` ambulances along their OSRM routes and
 * walks incidents through the lifecycle so the platform is alive without devices.
 * A unit is handed back to the real device as soon as it reports GPS (60s window).
 */

const DEVICE_TAKEOVER_MS = 60_000;
/** Speed multiplier keeps demos snappy (≈ 40 km/h × 3). */
const SIM_SPEED_MS = 11 * 3;
const ON_SCENE_MS = 15_000;
const AT_HOSPITAL_MS = 20_000;

interface Progress {
  key: string;
  travelled: number;
  waitUntil?: number;
}
const progress = new Map<string, Progress>();

export function pointAlong(route: [number, number][], meters: number): { pos: LatLng; heading: number; done: boolean } {
  let remaining = meters;
  for (let i = 0; i < route.length - 1; i++) {
    const a = { lat: route[i]![0], lng: route[i]![1] };
    const b = { lat: route[i + 1]![0], lng: route[i + 1]![1] };
    const seg = haversine(a, b);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      return {
        pos: { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t },
        heading: bearing(a, b),
        done: false,
      };
    }
    remaining -= seg;
  }
  const last = route.at(-1) ?? [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng];
  return { pos: { lat: last[0], lng: last[1] }, heading: 0, done: true };
}

async function step(dtSeconds: number) {
  const cutoff = new Date(Date.now() - DEVICE_TAKEOVER_MS);
  const units = await Ambulance.find({
    simulated: true,
    currentIncident: { $exists: true, $ne: null },
    $or: [{ lastDevicePingAt: { $exists: false } }, { lastDevicePingAt: null }, { lastDevicePingAt: { $lt: cutoff } }],
  });

  for (const unit of units) {
    const incident = await Incident.findById(unit.currentIncident, { status: 1, route: 1 }).lean();
    if (!incident) continue;
    const status = incident.status as IncidentStatus;
    const key = `${incident._id}:${status}`;
    let p = progress.get(String(unit._id));
    if (!p || p.key !== key) {
      p = { key, travelled: 0 };
      progress.set(String(unit._id), p);
    }

    try {
      switch (status) {
        case 'assigned':
          await transitionIncident(incident._id, 'en_route', undefined, 'Crew mobilised');
          break;
        case 'en_route':
        case 'transporting': {
          const route = (incident.route ?? []) as [number, number][];
          if (route.length < 2) {
            await transitionIncident(incident._id, status === 'en_route' ? 'on_scene' : 'at_hospital', undefined);
            break;
          }
          p.travelled += SIM_SPEED_MS * dtSeconds;
          const { pos, heading, done } = pointAlong(route, p.travelled);
          await ingestLocation(
            { ambulanceId: String(unit._id), lat: pos.lat, lng: pos.lng, heading, speed: SIM_SPEED_MS },
            'simulator',
          );
          if (done) await transitionIncident(incident._id, status === 'en_route' ? 'on_scene' : 'at_hospital', undefined);
          break;
        }
        case 'on_scene':
          p.waitUntil ??= Date.now() + ON_SCENE_MS;
          if (Date.now() >= p.waitUntil) await transitionIncident(incident._id, 'transporting', undefined, 'Patient loaded');
          break;
        case 'at_hospital':
          p.waitUntil ??= Date.now() + AT_HOSPITAL_MS;
          if (Date.now() >= p.waitUntil) await transitionIncident(incident._id, 'closed', undefined, 'Handover complete');
          break;
        default:
          break;
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message, unit: unit.callsign }, 'simulator step failed');
    }
  }
}

const SAMPLE_SYMPTOMS = [
  ['Chest pain', 'Difficulty breathing'],
  ['Road accident', 'Fracture'],
  ['Fever', 'Dizziness'],
  ['Unconscious'],
  ['Abdominal pain', 'Vomiting'],
  ['Stroke'],
  ['Fall', 'Head injury'],
];

async function maybeSpawnIncident() {
  const active = await Incident.countDocuments({ status: { $in: ['requested', 'assigned', 'en_route', 'on_scene', 'transporting'] } });
  if (active >= 3) return;
  const jitter = () => (Math.random() - 0.5) * 0.08;
  const symptoms = SAMPLE_SYMPTOMS[Math.floor(Math.random() * SAMPLE_SYMPTOMS.length)]!;
  await createIncident(
    {
      location: { lat: DEFAULT_CENTER.lat + jitter(), lng: DEFAULT_CENTER.lng + jitter() },
      symptoms,
      description: 'Simulated emergency call',
      callerPhone: '+91 90000 00000',
    },
    undefined,
  );
}

export function startSimulator() {
  if (!env.SIMULATOR_ENABLED) return () => {};
  logger.info({ tickMs: env.SIMULATOR_TICK_MS }, 'Ambulance simulator started');
  let running = false;
  let last = Date.now();
  const tick = setInterval(async () => {
    if (running) return; // never overlap ticks
    running = true;
    const now = Date.now();
    try {
      await step((now - last) / 1000);
    } catch (err) {
      logger.error({ err }, 'simulator tick failed');
    } finally {
      last = now;
      running = false;
    }
  }, env.SIMULATOR_TICK_MS);

  const spawner = env.SIMULATOR_AUTO_INCIDENTS
    ? setInterval(() => void maybeSpawnIncident().catch((err: unknown) => logger.error({ err }, 'spawn failed')), 90_000)
    : undefined;

  return () => {
    clearInterval(tick);
    if (spawner) clearInterval(spawner);
  };
}
