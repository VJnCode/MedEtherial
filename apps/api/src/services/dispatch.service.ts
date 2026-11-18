import {
  canTransition,
  fromPoint,
  toPoint,
  triage,
  type CreateIncident,
  type IncidentStatus,
  type IncidentUpdateEvent,
  type LatLng,
  type Severity,
  type Vitals,
} from '@medetherial/shared';
import { Types, type HydratedDocument } from 'mongoose';
import type { AuthContext } from '../auth/context.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { estimateEta, getRoute, remainingAlongRoute } from '../lib/osrm.js';
import {
  Ambulance,
  Hospital,
  Incident,
  LocationPing,
  Patient,
  generateIncidentRef,
  type IncidentDoc,
} from '../models/index.js';
import { publishAmbulanceLocation, publishHospitalAlert, publishIncidentUpdate } from '../realtime/bus.js';
import { patientIdOf } from './access.service.js';

type IncidentHydrated = HydratedDocument<IncidentDoc>;
const MAX_DISPATCH_RADIUS_M = 60_000;
const TRAUMA_KEYWORDS = ['road accident', 'head injury', 'fracture', 'severe bleeding', 'burns'];

export function toIncidentEvent(i: IncidentHydrated | (IncidentDoc & { _id: Types.ObjectId })): IncidentUpdateEvent {
  return {
    incidentId: String(i._id),
    reference: i.reference,
    status: i.status as IncidentStatus,
    severity: i.severity as Severity,
    ambulanceId: i.ambulance ? String(i.ambulance) : undefined,
    hospitalId: i.hospital ? String(i.hospital) : undefined,
    etaSeconds: i.etaSeconds ?? undefined,
    route: (i.route as [number, number][] | undefined) ?? undefined,
    at: new Date().toISOString(),
  };
}

export interface HospitalCandidate {
  _id: Types.ObjectId;
  distance: number;
  traumaCenter: boolean;
  erBedsAvailable: number;
  erBedsTotal: number;
}

/**
 * Pure ranking: distance, penalised when trauma care is needed but unavailable,
 * and slightly when the ER is nearly full. Lower is better.
 */
export function rankHospitals(candidates: HospitalCandidate[], needsTrauma: boolean): HospitalCandidate[] {
  const score = (h: HospitalCandidate) => {
    let s = h.distance;
    if (needsTrauma && !h.traumaCenter) s *= 1.6;
    const occupancy = h.erBedsTotal > 0 ? 1 - h.erBedsAvailable / h.erBedsTotal : 1;
    if (occupancy > 0.85) s *= 1.25;
    return s;
  };
  return [...candidates].sort((a, b) => score(a) - score(b));
}

export function needsTraumaCare(symptoms: string[], severity: Severity) {
  const s = symptoms.join(' ').toLowerCase();
  return (severity === 'critical' || severity === 'high') && TRAUMA_KEYWORDS.some((k) => s.includes(k));
}

async function selectHospital(location: LatLng, symptoms: string[], severity: Severity) {
  const candidates = await Hospital.aggregate<HospitalCandidate>([
    {
      $geoNear: {
        near: toPoint(location),
        distanceField: 'distance',
        spherical: true,
        maxDistance: MAX_DISPATCH_RADIUS_M,
        query: { active: true, erBedsAvailable: { $gt: 0 } },
      },
    },
    { $limit: 8 },
    { $project: { distance: 1, traumaCenter: 1, erBedsAvailable: 1, erBedsTotal: 1 } },
  ]);
  return rankHospitals(candidates, needsTraumaCare(symptoms, severity))[0];
}

/** Finds and atomically claims the nearest suitable available ambulance. */
async function claimAmbulance(location: LatLng, severity: Severity, incidentId: Types.ObjectId) {
  const near = (query: Record<string, unknown>) =>
    Ambulance.aggregate<{ _id: Types.ObjectId; distance: number }>([
      {
        $geoNear: {
          near: toPoint(location),
          distanceField: 'distance',
          spherical: true,
          maxDistance: MAX_DISPATCH_RADIUS_M,
          query: { status: 'available', ...query },
        },
      },
      { $limit: 5 },
      { $project: { distance: 1 } },
    ]);

  // Critical patients get Advanced Life Support units first.
  let candidates = severity === 'critical' ? await near({ type: 'ALS' }) : [];
  if (candidates.length === 0) candidates = await near({});

  for (const c of candidates) {
    // Compare-and-set guards against two dispatchers claiming the same unit.
    const claimed = await Ambulance.findOneAndUpdate(
      { _id: c._id, status: 'available' },
      { $set: { status: 'dispatched', currentIncident: incidentId } },
      { new: true },
    );
    if (claimed) return claimed;
  }
  return null;
}

function pushTimeline(incident: IncidentHydrated, status: IncidentStatus, by?: Types.ObjectId, note?: string) {
  incident.status = status;
  incident.timeline.push({ status, at: new Date(), by, note });
}

/** Attempts to assign ambulance + hospital to a `requested` incident. Returns true on success. */
export async function autoDispatch(incidentId: Types.ObjectId | string, by?: Types.ObjectId): Promise<boolean> {
  const incident = await Incident.findById(incidentId);
  if (!incident || incident.status !== 'requested') return false;
  const pickup = fromPoint(incident.location);
  const severity = incident.severity as Severity;

  const ambulance = await claimAmbulance(pickup, severity, incident._id);
  if (!ambulance) {
    logger.warn({ incident: incident.reference }, 'No ambulance available — incident queued');
    return false;
  }
  const hospital = await selectHospital(pickup, incident.symptoms, severity);
  const route = await getRoute(fromPoint(ambulance.location), pickup);

  incident.ambulance = ambulance._id;
  if (hospital) incident.hospital = hospital._id;
  incident.route = route.coordinates;
  incident.routeDistanceMeters = Math.round(route.distanceMeters);
  incident.etaSeconds = Math.round(route.durationSeconds);
  incident.assignedAt = new Date();
  pushTimeline(incident, 'assigned', by, `Unit ${ambulance.callsign} dispatched`);
  await incident.save();

  logger.info({ incident: incident.reference, ambulance: ambulance.callsign }, 'Incident dispatched');
  publishIncidentUpdate(toIncidentEvent(incident));
  return true;
}

/** Retry dispatch for queued incidents, most severe first. */
export async function dispatchPending(): Promise<number> {
  const order: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };
  const pending = await Incident.find({ status: 'requested' }, { _id: 1, severity: 1, createdAt: 1 }).lean();
  pending.sort((a, b) => order[a.severity]! - order[b.severity]! || +a.createdAt - +b.createdAt);
  let n = 0;
  for (const p of pending) {
    if (await autoDispatch(p._id)) n++;
    else break; // no more units
  }
  return n;
}

export async function createIncident(input: CreateIncident, auth: AuthContext | undefined) {
  let patientId: Types.ObjectId | undefined;
  if (input.patientId) {
    if (auth && !auth.permissions.has('incident:dispatch')) throw forbidden('Only dispatchers may raise incidents for others');
    if (!(await Patient.exists({ _id: input.patientId }))) throw notFound('Patient not found');
    patientId = new Types.ObjectId(input.patientId);
  } else if (auth?.roles.includes('patient')) {
    patientId = await patientIdOf(auth);
    const open = await Incident.exists({
      patient: patientId,
      status: { $in: ['requested', 'assigned', 'en_route', 'on_scene', 'transporting'] },
    });
    if (open) throw conflict('You already have an active emergency request');
  }

  const severity = triage(input.symptoms, input.vitals);
  const incident = await Incident.create({
    reference: generateIncidentRef(),
    patient: patientId,
    reportedBy: auth?.userId ?? new Types.ObjectId(),
    callerPhone: input.callerPhone,
    location: toPoint(input.location),
    address: input.address,
    symptoms: input.symptoms,
    description: input.description,
    severity,
    status: 'requested',
    timeline: [{ status: 'requested', at: new Date(), by: auth?.userId }],
    vitals: input.vitals ? [{ at: new Date(), by: auth?.userId, vitals: input.vitals }] : [],
  });
  publishIncidentUpdate(toIncidentEvent(incident), { isNew: true });

  await autoDispatch(incident._id);
  return (await Incident.findById(incident._id))!;
}

/** Manual (re)assignment by a dispatcher. */
export async function assignIncident(
  incidentId: string,
  opts: { ambulanceId?: string; hospitalId?: string },
  auth: AuthContext,
) {
  const incident = await Incident.findById(incidentId);
  if (!incident) throw notFound('Incident not found');
  if (!['requested', 'assigned', 'en_route', 'on_scene', 'transporting'].includes(incident.status)) {
    throw conflict(`Cannot reassign an incident that is ${incident.status}`);
  }

  if (opts.hospitalId) {
    const h = await Hospital.findById(opts.hospitalId);
    if (!h) throw notFound('Hospital not found');
    incident.hospital = h._id;
  }

  if (opts.ambulanceId && String(incident.ambulance) !== opts.ambulanceId) {
    const next = await Ambulance.findOneAndUpdate(
      { _id: opts.ambulanceId, status: 'available' },
      { $set: { status: 'dispatched', currentIncident: incident._id } },
      { new: true },
    );
    if (!next) throw conflict('Ambulance is not available');
    if (incident.ambulance) {
      await Ambulance.updateOne(
        { _id: incident.ambulance },
        { $set: { status: 'available' }, $unset: { currentIncident: 1 } },
      );
    }
    const route = await getRoute(fromPoint(next.location), fromPoint(incident.location));
    incident.ambulance = next._id;
    incident.route = route.coordinates;
    incident.routeDistanceMeters = Math.round(route.distanceMeters);
    incident.etaSeconds = Math.round(route.durationSeconds);
    incident.assignedAt = new Date();
    if (incident.status === 'requested') pushTimeline(incident, 'assigned', auth.userId, `Unit ${next.callsign} assigned`);
    else incident.timeline.push({ status: incident.status, at: new Date(), by: auth.userId, note: `Reassigned to ${next.callsign}` });
  } else if (!incident.ambulance && incident.status === 'requested') {
    await incident.save();
    await autoDispatch(incident._id, auth.userId);
    return (await Incident.findById(incident._id))!;
  }

  await incident.save();
  publishIncidentUpdate(toIncidentEvent(incident));
  return incident;
}

async function isCrewOf(auth: AuthContext, ambulanceId?: Types.ObjectId | null) {
  if (!ambulanceId) return false;
  return Boolean(await Ambulance.exists({ _id: ambulanceId, crew: auth.userId }));
}

/**
 * Advances the incident state machine with role checks and side-effects
 * (routing to hospital, bed accounting, releasing the unit).
 * `auth` undefined = system actor (simulator).
 */
export async function transitionIncident(
  incidentId: string | Types.ObjectId,
  to: IncidentStatus,
  auth: AuthContext | undefined,
  note?: string,
) {
  const incident = await Incident.findById(incidentId);
  if (!incident) throw notFound('Incident not found');
  const from = incident.status as IncidentStatus;
  if (!canTransition(from, to)) throw conflict(`Invalid transition ${from} → ${to}`);
  if (to === 'assigned') throw badRequest('Use the assign endpoint to assign units');

  if (auth) {
    const isDispatcher = auth.permissions.has('incident:dispatch');
    if (to === 'cancelled') {
      const pid = await patientIdOf(auth);
      const ownsIt =
        String(incident.reportedBy) === String(auth.userId) || (pid && String(incident.patient) === String(pid));
      if (!isDispatcher && !(ownsIt && ['requested', 'assigned', 'en_route'].includes(from))) throw forbidden();
    } else if (!isDispatcher) {
      if (!auth.permissions.has('incident:update_status') || !(await isCrewOf(auth, incident.ambulance))) {
        throw forbidden('Only the assigned crew or a dispatcher can update this incident');
      }
    }
  }

  pushTimeline(incident, to, auth?.userId, note);
  const now = new Date();

  if (to === 'en_route' && incident.ambulance) {
    await Ambulance.updateOne({ _id: incident.ambulance }, { $set: { status: 'dispatched' } });
  }
  if (to === 'on_scene') {
    incident.onSceneAt = now;
    incident.etaSeconds = 0;
    if (incident.ambulance) await Ambulance.updateOne({ _id: incident.ambulance }, { $set: { status: 'busy' } });
  }
  if (to === 'transporting') {
    if (!incident.hospital) {
      const h = await selectHospital(fromPoint(incident.location), incident.symptoms, incident.severity as Severity);
      if (!h) throw conflict('No receiving hospital with ER capacity found');
      incident.hospital = h._id;
    }
    const amb = incident.ambulance ? await Ambulance.findById(incident.ambulance) : null;
    const hospital = await Hospital.findById(incident.hospital);
    if (hospital) {
      const from = amb ? fromPoint(amb.location) : fromPoint(incident.location);
      const route = await getRoute(from, fromPoint(hospital.location));
      incident.route = route.coordinates;
      incident.routeDistanceMeters = Math.round(route.distanceMeters);
      incident.etaSeconds = Math.round(route.durationSeconds);
      const latestVitals = incident.vitals.at(-1)?.vitals;
      publishHospitalAlert({
        incidentId: String(incident._id),
        reference: incident.reference,
        hospitalId: String(hospital._id),
        severity: incident.severity as Severity,
        etaSeconds: incident.etaSeconds,
        patientSummary: `${incident.symptoms.join(', ')}${
          latestVitals ? ` · HR ${latestVitals.heartRate ?? '–'} · SpO₂ ${latestVitals.spo2 ?? '–'}%` : ''
        }`,
        at: now.toISOString(),
      });
    }
  }
  if (to === 'at_hospital') {
    incident.atHospitalAt = now;
    incident.etaSeconds = 0;
    incident.route = undefined;
    if (incident.hospital) {
      await Hospital.updateOne(
        { _id: incident.hospital, erBedsAvailable: { $gt: 0 } },
        { $inc: { erBedsAvailable: -1 } },
      );
    }
  }
  if (to === 'closed' || to === 'cancelled') {
    incident.closedAt = now;
    incident.route = undefined;
    incident.etaSeconds = undefined;
    if (incident.ambulance) {
      await Ambulance.updateOne(
        { _id: incident.ambulance, currentIncident: incident._id },
        { $set: { status: 'available' }, $unset: { currentIncident: 1 } },
      );
    }
  }

  await incident.save();
  publishIncidentUpdate(toIncidentEvent(incident));
  if (to === 'closed' || to === 'cancelled') {
    // A unit was freed — serve the queue.
    void dispatchPending().catch((err: unknown) => logger.error({ err }, 'dispatchPending failed'));
  }
  return incident;
}

export async function recordIncidentVitals(incidentId: string, vitals: Vitals, auth: AuthContext) {
  const incident = await Incident.findById(incidentId);
  if (!incident) throw notFound('Incident not found');
  if (!auth.permissions.has('incident:dispatch') && !(await isCrewOf(auth, incident.ambulance))) throw forbidden();
  incident.vitals.push({ at: new Date(), by: auth.userId, vitals });
  const reTriaged = triage(incident.symptoms, vitals);
  const order = ['low', 'moderate', 'high', 'critical'];
  if (order.indexOf(reTriaged) > order.indexOf(incident.severity)) incident.severity = reTriaged;
  await incident.save();
  publishIncidentUpdate(toIncidentEvent(incident));
  return incident;
}

const lastPingAt = new Map<string, number>();

/**
 * Ingests a GPS position for an ambulance from a crew device or the simulator,
 * updates ETA and fans out to dispatch / incident / hospital rooms.
 */
export async function ingestLocation(
  ping: { ambulanceId: string; lat: number; lng: number; heading?: number; speed?: number; accuracy?: number },
  source: 'device' | 'simulator',
  auth?: AuthContext,
) {
  if (source === 'device') {
    if (!auth) throw forbidden();
    const allowed = auth.roles.includes('admin') || (await isCrewOf(auth, new Types.ObjectId(ping.ambulanceId)));
    if (!allowed) throw forbidden('You are not crew on this ambulance');
    if (ping.accuracy !== undefined && ping.accuracy > 200) return null; // too imprecise to be useful
  }

  // Flood protection (after authorisation, so rejected callers can't starve real crews):
  // at most one accepted ping per unit per 800ms.
  const now = Date.now();
  if (now - (lastPingAt.get(ping.ambulanceId) ?? 0) < 800) return null;
  lastPingAt.set(ping.ambulanceId, now);

  const pos: LatLng = { lat: ping.lat, lng: ping.lng };
  const ambulance = await Ambulance.findByIdAndUpdate(
    ping.ambulanceId,
    {
      $set: {
        location: toPoint(pos),
        heading: ping.heading,
        speed: ping.speed,
        lastSeenAt: new Date(),
        ...(source === 'device' ? { lastDevicePingAt: new Date() } : {}),
      },
    },
    { new: true },
  );
  if (!ambulance) throw notFound('Ambulance not found');

  let etaSeconds: number | undefined;
  if (ambulance.currentIncident) {
    const incident = await Incident.findById(ambulance.currentIncident, { route: 1, status: 1 }).lean();
    if (incident?.route?.length && ['assigned', 'en_route', 'transporting'].includes(incident.status)) {
      etaSeconds = estimateEta(remainingAlongRoute(incident.route as [number, number][], pos), ping.speed);
      await Incident.updateOne({ _id: incident._id }, { $set: { etaSeconds } });
    }
  }

  LocationPing.create({
    at: new Date(),
    meta: { ambulance: ambulance._id, incident: ambulance.currentIncident, source },
    location: toPoint(pos),
    heading: ping.heading,
    speed: ping.speed,
    accuracy: ping.accuracy,
  }).catch((err: unknown) => logger.debug({ err }, 'ping persist failed'));

  publishAmbulanceLocation({
    ambulanceId: String(ambulance._id),
    callsign: ambulance.callsign,
    status: ambulance.status as never,
    location: pos,
    heading: ping.heading,
    speed: ping.speed,
    incidentId: ambulance.currentIncident ? String(ambulance.currentIncident) : undefined,
    etaSeconds,
    at: new Date().toISOString(),
  });
  return { ambulanceId: String(ambulance._id), etaSeconds };
}
