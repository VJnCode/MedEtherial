import { createAmbulance, fromPoint, locationPing, toPoint, updateAmbulance } from '@medetherial/shared';
import { Router } from 'express';
import { authOf } from '../auth/middleware.js';
import { notFound } from '../lib/errors.js';
import { defineRoute, idParams } from '../lib/route.js';
import { Ambulance } from '../models/index.js';
import { audit } from '../services/audit.service.js';
import { ingestLocation } from '../services/dispatch.service.js';

export const fleetRouter = Router();
const base = '/api/v1';

const view = (a: InstanceType<typeof Ambulance>) => ({ ...a.toJSON(), position: fromPoint(a.location) });

defineRoute(
  fleetRouter,
  base,
  { method: 'get', path: '/ambulances', summary: 'Fleet with live positions', tag: 'Fleet', permissions: ['fleet:read'] },
  async () => (await Ambulance.find().sort({ callsign: 1 }).populate('crew', 'name')).map(view),
);

defineRoute(
  fleetRouter,
  base,
  {
    method: 'post',
    path: '/ambulances',
    summary: 'Register an ambulance',
    tag: 'Fleet',
    permissions: ['fleet:manage'],
    body: createAmbulance,
  },
  async ({ req, body }) => {
    const a = await Ambulance.create({
      callsign: body.callsign,
      type: body.type,
      plate: body.plate,
      baseHospital: body.baseHospitalId,
      location: toPoint(body.location),
      status: 'available',
    });
    audit(authOf(req), { action: 'ambulance.create', resourceType: 'Ambulance', resourceId: String(a._id) }, req);
    return view(a);
  },
);

defineRoute(
  fleetRouter,
  base,
  {
    method: 'patch',
    path: '/ambulances/:id',
    summary: 'Update ambulance status or crew',
    tag: 'Fleet',
    permissions: ['fleet:manage'],
    params: idParams,
    body: updateAmbulance,
  },
  async ({ req, params, body }) => {
    const a = await Ambulance.findByIdAndUpdate(params.id, { $set: body }, { new: true, runValidators: true });
    if (!a) throw notFound('Ambulance not found');
    audit(authOf(req), { action: 'ambulance.update', resourceType: 'Ambulance', resourceId: params.id, meta: body }, req);
    return view(a);
  },
);

defineRoute(
  fleetRouter,
  base,
  {
    method: 'post',
    path: '/tracking/ping',
    summary: 'Publish GPS position (REST fallback for the Socket.IO channel)',
    tag: 'Tracking',
    permissions: ['location:publish'],
    body: locationPing,
  },
  async ({ req, body }) => (await ingestLocation(body, 'device', authOf(req))) ?? { throttled: true },
);
