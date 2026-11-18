import { createHospital, fromPoint, toPoint, updateHospitalCapacity } from '@medetherial/shared';
import { Router } from 'express';
import { authOf } from '../auth/middleware.js';
import { forbidden, notFound } from '../lib/errors.js';
import { defineRoute, idParams } from '../lib/route.js';
import { Hospital } from '../models/index.js';
import { hospitalIdOf } from '../services/access.service.js';
import { audit } from '../services/audit.service.js';

export const hospitalsRouter = Router();
const base = '/api/v1/hospitals';

const view = (h: InstanceType<typeof Hospital>) => ({ ...h.toJSON(), position: fromPoint(h.location) });

defineRoute(
  hospitalsRouter,
  base,
  { method: 'get', path: '/', summary: 'List hospitals with live ER capacity', tag: 'Hospitals', permissions: ['hospital:read'] },
  async () => (await Hospital.find({ active: true }).sort({ name: 1 })).map(view),
);

defineRoute(
  hospitalsRouter,
  base,
  {
    method: 'post',
    path: '/',
    summary: 'Register a hospital (admin)',
    tag: 'Hospitals',
    permissions: ['user:manage'],
    body: createHospital,
  },
  async ({ req, body }) => {
    const h = await Hospital.create({ ...body, location: toPoint(body.location) });
    audit(authOf(req), { action: 'hospital.create', resourceType: 'Hospital', resourceId: String(h._id) }, req);
    return view(h);
  },
);

defineRoute(
  hospitalsRouter,
  base,
  {
    method: 'patch',
    path: '/:id/capacity',
    summary: 'Update available ER beds (hospital admin)',
    tag: 'Hospitals',
    permissions: ['hospital:manage'],
    params: idParams,
    body: updateHospitalCapacity,
  },
  async ({ req, params, body }) => {
    const auth = authOf(req);
    if (!auth.roles.includes('admin')) {
      const own = await hospitalIdOf(auth);
      if (String(own) !== params.id) throw forbidden('You can only manage your own hospital');
    }
    const h = await Hospital.findById(params.id);
    if (!h) throw notFound('Hospital not found');
    h.erBedsAvailable = Math.min(body.erBedsAvailable, h.erBedsTotal);
    await h.save();
    audit(auth, { action: 'hospital.capacity.update', resourceType: 'Hospital', resourceId: params.id, meta: body }, req);
    return view(h);
  },
);
