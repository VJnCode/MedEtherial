import {
  INCIDENT_STATUSES,
  SEVERITIES,
  assignIncident,
  createIncident,
  fromPoint,
  pagination,
  updateIncidentStatus,
  vitalsSchema,
} from '@medetherial/shared';
import { Router } from 'express';
import { z } from 'zod';
import { authOf } from '../auth/middleware.js';
import { notFound } from '../lib/errors.js';
import { paginate } from '../lib/paginate.js';
import { defineRoute, idParams } from '../lib/route.js';
import { Incident } from '../models/index.js';
import { assertIncidentAccess, incidentScope } from '../services/access.service.js';
import { audit } from '../services/audit.service.js';
import {
  assignIncident as assignIncidentSvc,
  createIncident as createIncidentSvc,
  recordIncidentVitals,
  transitionIncident,
} from '../services/dispatch.service.js';

export const incidentsRouter = Router();
const base = '/api/v1/incidents';

const populate = [
  { path: 'ambulance', select: 'callsign type plate status location crew', populate: { path: 'crew', select: 'name phone' } },
  { path: 'hospital', select: 'name address phone location erBedsAvailable' },
  { path: 'patient', select: 'mrn bloodGroup allergies conditions user', populate: { path: 'user', select: 'name' } },
];

const view = (i: InstanceType<typeof Incident>) => {
  const json = i.toJSON() as Record<string, unknown> & {
    ambulance?: { location?: { coordinates: number[] } };
    hospital?: { location?: { coordinates: number[] } };
  };
  return {
    ...json,
    position: fromPoint(i.location),
    ambulancePosition: json.ambulance?.location ? fromPoint(json.ambulance.location) : undefined,
    hospitalPosition: json.hospital?.location ? fromPoint(json.hospital.location) : undefined,
  };
};

defineRoute(
  incidentsRouter,
  base,
  {
    method: 'get',
    path: '/',
    summary: 'List incidents visible to the caller',
    tag: 'Incidents',
    permissions: ['incident:read:self', 'incident:read:assigned', 'incident:read:all'],
    query: pagination.extend({
      status: z.enum(INCIDENT_STATUSES).optional(),
      severity: z.enum(SEVERITIES).optional(),
      active: z.enum(['true', 'false']).optional(),
    }),
  },
  async ({ req, query }) => {
    const scope = await incidentScope(authOf(req));
    if (!scope) return { items: [], page: 1, limit: query.limit, total: 0, pages: 1 };
    const filter: Record<string, unknown> = { ...scope };
    if (query.status) filter.status = query.status;
    if (query.severity) filter.severity = query.severity;
    if (query.active === 'true') filter.status = { $in: ['requested', 'assigned', 'en_route', 'on_scene', 'transporting'] };
    const page = await paginate(Incident, filter, { ...query, populate });
    return { ...page, items: (page.items as InstanceType<typeof Incident>[]).map(view) };
  },
);

defineRoute(
  incidentsRouter,
  base,
  {
    method: 'post',
    path: '/',
    summary: 'Raise an emergency (SOS). Auto-triages and dispatches the nearest unit.',
    tag: 'Incidents',
    permissions: ['incident:create'],
    body: createIncident,
  },
  async ({ req, body }) => {
    const auth = authOf(req);
    const incident = await createIncidentSvc(body, auth);
    audit(auth, { action: 'incident.create', resourceType: 'Incident', resourceId: String(incident._id), meta: { severity: incident.severity } }, req);
    return view(await incident.populate(populate));
  },
);

defineRoute(
  incidentsRouter,
  base,
  {
    method: 'get',
    path: '/:id',
    summary: 'Incident detail with live route and ETA',
    tag: 'Incidents',
    permissions: ['incident:read:self', 'incident:read:assigned', 'incident:read:all'],
    params: idParams,
  },
  async ({ req, params }) => {
    await assertIncidentAccess(authOf(req), params.id);
    const incident = await Incident.findById(params.id).populate(populate).populate('timeline.by', 'name');
    if (!incident) throw notFound('Incident not found');
    return view(incident);
  },
);

defineRoute(
  incidentsRouter,
  base,
  {
    method: 'patch',
    path: '/:id/status',
    summary: 'Advance incident status (crew / dispatcher) or cancel (reporter)',
    tag: 'Incidents',
    permissions: ['incident:update_status', 'incident:create'],
    params: idParams,
    body: updateIncidentStatus,
  },
  async ({ req, params, body }) => {
    const auth = authOf(req);
    await assertIncidentAccess(auth, params.id);
    const incident = await transitionIncident(params.id, body.status, auth, body.note);
    audit(auth, { action: `incident.${body.status}`, resourceType: 'Incident', resourceId: params.id }, req);
    return view(await incident.populate(populate));
  },
);

defineRoute(
  incidentsRouter,
  base,
  {
    method: 'post',
    path: '/:id/assign',
    summary: 'Manually assign / reassign ambulance or destination hospital',
    tag: 'Incidents',
    permissions: ['incident:dispatch'],
    params: idParams,
    body: assignIncident,
  },
  async ({ req, params, body }) => {
    const auth = authOf(req);
    const incident = await assignIncidentSvc(params.id, body, auth);
    audit(auth, { action: 'incident.assign', resourceType: 'Incident', resourceId: params.id, meta: body }, req);
    return view(await incident.populate(populate));
  },
);

defineRoute(
  incidentsRouter,
  base,
  {
    method: 'post',
    path: '/:id/vitals',
    summary: 'Record patient vitals en route (re-triages severity upwards)',
    tag: 'Incidents',
    permissions: ['incident:update_status'],
    params: idParams,
    body: vitalsSchema,
  },
  async ({ req, params, body }) => {
    const auth = authOf(req);
    const incident = await recordIncidentVitals(params.id, body, auth);
    audit(auth, { action: 'incident.vitals', resourceType: 'Incident', resourceId: params.id }, req);
    return view(await incident.populate(populate));
  },
);
