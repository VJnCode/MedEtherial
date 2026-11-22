import { ROLES, ROLE_LABELS, canGrantRole, canManageUser, pagination, updateUserRoles } from '@medetherial/shared';
import { Router } from 'express';
import { z } from 'zod';
import { authOf } from '../auth/middleware.js';
import { forbidden, notFound } from '../lib/errors.js';
import { paginate } from '../lib/paginate.js';
import { defineRoute, idParams } from '../lib/route.js';
import { Ambulance, Appointment, AuditLog, Hospital, Incident, User } from '../models/index.js';
import { audit } from '../services/audit.service.js';
import { applyUserRoles, currentRolesOf, isBootstrapAdminEmail } from '../services/roles.service.js';

export const adminRouter = Router();
const base = '/api/v1';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

defineRoute(
  adminRouter,
  base,
  {
    method: 'get',
    path: '/admin/users',
    summary: 'List users',
    tag: 'Admin',
    permissions: ['user:manage'],
    query: pagination.extend({ q: z.string().max(80).optional(), role: z.enum(ROLES).optional() }),
  },
  async ({ query }) => {
    const filter: Record<string, unknown> = {};
    if (query.role) filter.roles = query.role;
    if (query.q) {
      const rx = new RegExp(escapeRegex(query.q), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }
    return paginate(User, filter, { ...query, sort: { name: 1 }, populate: { path: 'hospital', select: 'name' } });
  },
);

defineRoute(
  adminRouter,
  base,
  {
    method: 'put',
    path: '/admin/users/:id/roles',
    summary: 'Replace a user’s roles (writes through to Keycloak)',
    tag: 'Admin',
    permissions: ['role:approve'],
    params: idParams,
    body: updateUserRoles,
  },
  async ({ req, params, body }) => {
    const auth = authOf(req);
    const user = await User.findById(params.id);
    if (!user) throw notFound('User not found');
    const isSelf = user._id.equals(auth.userId);
    const current = await currentRolesOf(user);
    if (!isSelf && !canManageUser(auth.roles, current)) throw forbidden('You cannot manage a user who outranks you');
    // Every role being added or removed must sit below the actor in the hierarchy.
    const changed = [...body.roles.filter((r) => !current.includes(r)), ...current.filter((r) => !body.roles.includes(r))];
    const denied = changed.find((r) => !canGrantRole(auth.roles, r));
    if (denied) throw forbidden(`Your role cannot grant or revoke ${ROLE_LABELS[denied]}`);
    if (current.includes('admin') && !body.roles.includes('admin')) {
      if (isSelf) throw forbidden('You cannot remove your own Administrator role');
      if (isBootstrapAdminEmail(user.email)) throw forbidden('This account is a configured platform owner and must keep the Administrator role');
    }
    const roles = await applyUserRoles(user, body.roles);
    audit(auth, { action: 'user.roles.update', resourceType: 'User', resourceId: params.id, meta: { roles } }, req);
    return user;
  },
);

defineRoute(
  adminRouter,
  base,
  {
    method: 'get',
    path: '/admin/audit',
    summary: 'Audit trail (append-only)',
    tag: 'Admin',
    permissions: ['audit:read'],
    query: pagination.extend({ action: z.string().max(60).optional(), resourceType: z.string().max(40).optional() }),
  },
  async ({ query }) => {
    const filter: Record<string, unknown> = {};
    if (query.action) filter.action = new RegExp(`^${escapeRegex(query.action)}`);
    if (query.resourceType) filter.resourceType = query.resourceType;
    return paginate(AuditLog, filter, { ...query, sort: { at: -1 } });
  },
);

defineRoute(
  adminRouter,
  base,
  {
    method: 'get',
    path: '/stats/overview',
    summary: 'Operational KPIs: incidents, response times, fleet & ER capacity',
    tag: 'Stats',
    permissions: ['incident:read:all', 'fleet:read', 'user:manage'],
  },
  async () => {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [fleet, incidentsByStatus, responseTimes, beds, daily, appts, users] = await Promise.all([
      Ambulance.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Incident.aggregate<{ _id: string; count: number }>([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Incident.aggregate<{ avg: number; p90: number[] }>([
        { $match: { onSceneAt: { $exists: true }, createdAt: { $gte: since } } },
        { $project: { secs: { $divide: [{ $subtract: ['$onSceneAt', '$createdAt'] }, 1000] } } },
        { $group: { _id: null, avg: { $avg: '$secs' }, all: { $push: '$secs' } } },
        { $project: { avg: 1, p90: { $percentile: { input: '$all', p: [0.9], method: 'approximate' } } } },
      ]).catch(() => []),
      Hospital.aggregate<{ total: number; available: number }>([
        { $match: { active: true } },
        { $group: { _id: null, total: { $sum: '$erBedsTotal' }, available: { $sum: '$erBedsAvailable' } } },
      ]),
      Incident.aggregate<{ _id: string; total: number; critical: number }>([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            total: { $sum: 1 },
            critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Appointment.countDocuments({ startsAt: { $gte: new Date() }, holdsSlot: true }),
      User.countDocuments(),
    ]);
    const toMap = (rows: { _id: string; count: number }[]) => Object.fromEntries(rows.map((r) => [r._id, r.count]));
    return {
      fleet: toMap(fleet),
      incidents: toMap(incidentsByStatus),
      responseTime: { avgSeconds: responseTimes[0]?.avg ?? null, p90Seconds: responseTimes[0]?.p90?.[0] ?? null },
      erBeds: beds[0] ?? { total: 0, available: 0 },
      daily: daily.map((d) => ({ date: d._id, total: d.total, critical: d.critical })),
      upcomingAppointments: appts,
      users,
    };
  },
);
