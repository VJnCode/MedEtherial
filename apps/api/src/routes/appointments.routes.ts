import { APPOINTMENT_STATUSES, createAppointment, pagination, updateAppointmentStatus } from '@medetherial/shared';
import { Router } from 'express';
import { z } from 'zod';
import { authOf } from '../auth/middleware.js';
import { notFound } from '../lib/errors.js';
import { paginate } from '../lib/paginate.js';
import { defineRoute, idParams } from '../lib/route.js';
import { Appointment } from '../models/index.js';
import { doctorOf, patientIdOf } from '../services/access.service.js';
import { bookAppointment, changeAppointmentStatus } from '../services/appointment.service.js';
import { audit } from '../services/audit.service.js';

export const appointmentsRouter = Router();
const base = '/api/v1/appointments';

const populate = [
  { path: 'doctor', select: 'specialty hospital user', populate: [{ path: 'user', select: 'name' }, { path: 'hospital', select: 'name' }] },
  { path: 'patient', select: 'mrn user', populate: { path: 'user', select: 'name email' } },
];

defineRoute(
  appointmentsRouter,
  base,
  {
    method: 'get',
    path: '/',
    summary: 'List appointments visible to the caller',
    tag: 'Appointments',
    permissions: ['appointment:read:self', 'appointment:read:assigned', 'user:manage'],
    query: pagination.extend({
      status: z.enum(APPOINTMENT_STATUSES).optional(),
      scope: z.enum(['upcoming', 'past', 'all']).default('all'),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    }),
  },
  async ({ req, query }) => {
    const auth = authOf(req);
    const filter: Record<string, unknown> = {};
    if (!auth.roles.includes('admin')) {
      const or: Record<string, unknown>[] = [];
      const pid = await patientIdOf(auth);
      if (pid) or.push({ patient: pid });
      const doc = auth.roles.includes('doctor') ? await doctorOf(auth) : null;
      if (doc) or.push({ doctor: doc._id });
      if (!or.length) return { items: [], page: 1, limit: query.limit, total: 0, pages: 1 };
      filter.$or = or;
    }
    if (query.status) filter.status = query.status;
    const now = new Date();
    const range: Record<string, Date> = {};
    if (query.scope === 'upcoming') range.$gte = now;
    if (query.scope === 'past') range.$lt = now;
    if (query.from) range.$gte = query.from;
    if (query.to) range.$lte = query.to;
    if (Object.keys(range).length) filter.startsAt = range;
    return paginate(Appointment, filter, {
      ...query,
      sort: { startsAt: query.scope === 'past' ? -1 : 1 },
      populate,
    });
  },
);

defineRoute(
  appointmentsRouter,
  base,
  {
    method: 'post',
    path: '/',
    summary: 'Book an appointment (patients)',
    tag: 'Appointments',
    permissions: ['appointment:create'],
    body: createAppointment,
  },
  async ({ req, body }) => {
    const auth = authOf(req);
    const appt = await bookAppointment(body, auth);
    audit(auth, { action: 'appointment.create', resourceType: 'Appointment', resourceId: String(appt._id) }, req);
    return appt.populate(populate);
  },
);

defineRoute(
  appointmentsRouter,
  base,
  {
    method: 'get',
    path: '/:id',
    summary: 'Appointment detail',
    tag: 'Appointments',
    permissions: ['appointment:read:self', 'appointment:read:assigned', 'user:manage'],
    params: idParams,
  },
  async ({ req, params }) => {
    const auth = authOf(req);
    const appt = await Appointment.findById(params.id).populate(populate);
    if (!appt) throw notFound('Appointment not found');
    if (!auth.roles.includes('admin')) {
      const pid = await patientIdOf(auth);
      const doc = await doctorOf(auth);
      const p = appt.patient as unknown as { _id: unknown };
      const d = appt.doctor as unknown as { _id: unknown };
      if (String(p._id) !== String(pid) && String(d._id) !== String(doc?._id)) throw notFound('Appointment not found');
    }
    return appt;
  },
);

defineRoute(
  appointmentsRouter,
  base,
  {
    method: 'patch',
    path: '/:id/status',
    summary: 'Confirm / complete / cancel / mark no-show',
    tag: 'Appointments',
    permissions: ['appointment:manage', 'appointment:create', 'user:manage'],
    params: idParams,
    body: updateAppointmentStatus,
  },
  async ({ req, params, body }) => {
    const auth = authOf(req);
    const appt = await changeAppointmentStatus(params.id, body.status, auth, body.note);
    audit(auth, { action: `appointment.${body.status}`, resourceType: 'Appointment', resourceId: params.id }, req);
    return appt.populate(populate);
  },
);
