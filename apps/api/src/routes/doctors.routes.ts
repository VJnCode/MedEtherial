import { pagination } from '@medetherial/shared';
import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../lib/errors.js';
import { paginate } from '../lib/paginate.js';
import { defineRoute, idParams } from '../lib/route.js';
import { Doctor, User } from '../models/index.js';
import { getSlots } from '../services/appointment.service.js';

export const doctorsRouter = Router();
const base = '/api/v1/doctors';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

defineRoute(
  doctorsRouter,
  base,
  {
    method: 'get',
    path: '/',
    summary: 'Search doctors by name or specialty',
    tag: 'Doctors',
    query: pagination.extend({ q: z.string().max(80).optional(), specialty: z.string().max(60).optional() }),
  },
  async ({ query }) => {
    const filter: Record<string, unknown> = {};
    if (query.specialty) filter.specialty = query.specialty;
    if (query.q) {
      const rx = new RegExp(escapeRegex(query.q), 'i');
      const users = await User.find({ name: rx, roles: 'doctor' }, { _id: 1 }).lean();
      filter.$or = [{ user: { $in: users.map((u) => u._id) } }, { specialty: rx }];
    }
    return paginate(Doctor, filter, {
      ...query,
      sort: { rating: -1 },
      populate: [
        { path: 'user', select: 'name email avatarUrl' },
        { path: 'hospital', select: 'name address' },
      ],
    });
  },
);

defineRoute(
  doctorsRouter,
  base,
  { method: 'get', path: '/specialties', summary: 'Distinct specialties', tag: 'Doctors' },
  async () => (await Doctor.distinct('specialty')).sort(),
);

defineRoute(
  doctorsRouter,
  base,
  { method: 'get', path: '/:id', summary: 'Doctor profile', tag: 'Doctors', params: idParams },
  async ({ params }) => {
    const d = await Doctor.findById(params.id).populate('user', 'name email avatarUrl').populate('hospital', 'name address phone');
    if (!d) throw notFound('Doctor not found');
    return d;
  },
);

defineRoute(
  doctorsRouter,
  base,
  {
    method: 'get',
    path: '/:id/slots',
    summary: 'Bookable 30-minute slots for a date',
    tag: 'Doctors',
    params: idParams,
    query: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  },
  async ({ params, query }) => getSlots(params.id, query.date),
);
