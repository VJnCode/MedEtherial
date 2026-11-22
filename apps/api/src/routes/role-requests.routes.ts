import {
  ROLES,
  ROLE_LABELS,
  ROLE_REQUEST_STATUSES,
  SELF_SERVICE_ROLES,
  canGrantRole,
  canManageUser,
  pagination,
  roleRequestCreate,
  roleRequestDecision,
  type Role,
} from '@medetherial/shared';
import { Router } from 'express';
import { z } from 'zod';
import { authOf } from '../auth/middleware.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { paginate } from '../lib/paginate.js';
import { defineRoute, idParams } from '../lib/route.js';
import { RoleRequest, User } from '../models/index.js';
import { audit } from '../services/audit.service.js';
import { addRole, applyUserRoles, currentRolesOf, isBootstrapAdminEmail } from '../services/roles.service.js';

export const roleRequestsRouter = Router();
const base = '/api/v1';

// ---------------------------------------------------------------- self-service

defineRoute(
  roleRequestsRouter,
  base,
  { method: 'get', path: '/me/role-requests', summary: 'My role requests (newest first)', tag: 'Roles' },
  async ({ req }) => {
    const auth = authOf(req);
    return RoleRequest.find({ user: auth.userId }).sort({ createdAt: -1 }).limit(50).populate('decidedBy', 'name');
  },
);

defineRoute(
  roleRequestsRouter,
  base,
  {
    method: 'post',
    path: '/me/role-requests',
    summary: 'Request an additional role. Self-service roles (patient) and requests by admins are granted immediately.',
    tag: 'Roles',
    body: roleRequestCreate,
  },
  async ({ req, body }) => {
    const auth = authOf(req);
    if (auth.roles.includes(body.role)) throw conflict(`You already have the ${ROLE_LABELS[body.role]} role`);

    // No approval needed: patient is open to everyone, and an approver can grant themselves anything they could grant others.
    if (SELF_SERVICE_ROLES.includes(body.role) || canGrantRole(auth.roles, body.role)) {
      const roles = await addRole(auth.userId, body.role);
      audit(auth, { action: 'user.roles.self_grant', resourceType: 'User', resourceId: String(auth.userId), meta: { role: body.role } }, req);
      return { granted: true, roles };
    }

    const existing = await RoleRequest.findOne({ user: auth.userId, role: body.role, status: 'pending' });
    if (existing) throw conflict(`Your request for ${ROLE_LABELS[body.role]} is already awaiting approval`);
    const request = await RoleRequest.create({ user: auth.userId, role: body.role, reason: body.reason });
    audit(auth, { action: 'role_request.create', resourceType: 'RoleRequest', resourceId: String(request._id), meta: { role: body.role } }, req);
    return { granted: false, request };
  },
);

defineRoute(
  roleRequestsRouter,
  base,
  { method: 'delete', path: '/me/role-requests/:id', summary: 'Withdraw one of my pending role requests', tag: 'Roles', params: idParams },
  async ({ req, params }) => {
    const auth = authOf(req);
    const request = await RoleRequest.findOneAndUpdate(
      { _id: params.id, user: auth.userId, status: 'pending' },
      { $set: { status: 'cancelled', decidedAt: new Date() } },
      { new: true },
    );
    if (!request) throw notFound('No pending request found');
    audit(auth, { action: 'role_request.cancel', resourceType: 'RoleRequest', resourceId: params.id }, req);
    return request;
  },
);

defineRoute(
  roleRequestsRouter,
  base,
  {
    method: 'delete',
    path: '/me/roles/:role',
    summary: 'Give up one of my roles (at least one role must remain)',
    tag: 'Roles',
    params: z.object({ role: z.enum(ROLES) }),
  },
  async ({ req, params }) => {
    const auth = authOf(req);
    const user = await User.findById(auth.userId).orFail();
    const current = await currentRolesOf(user);
    if (!current.includes(params.role)) throw notFound('You do not have that role');
    const next = current.filter((r) => r !== params.role);
    if (!next.length) throw badRequest('You must keep at least one role');
    if (params.role === 'admin' && isBootstrapAdminEmail(user.email)) {
      throw forbidden('This account is a configured platform owner and must keep the Administrator role');
    }
    const roles = await applyUserRoles(user, next);
    audit(auth, { action: 'user.roles.self_remove', resourceType: 'User', resourceId: String(user._id), meta: { role: params.role } }, req);
    return { roles };
  },
);

// ---------------------------------------------------------------- approvals

defineRoute(
  roleRequestsRouter,
  base,
  {
    method: 'get',
    path: '/admin/role-requests',
    summary: 'Role requests awaiting (or past) approval',
    tag: 'Roles',
    permissions: ['role:approve'],
    query: pagination.extend({ status: z.enum(ROLE_REQUEST_STATUSES).default('pending') }),
  },
  async ({ query }) =>
    paginate(RoleRequest, { status: query.status }, {
      ...query,
      sort: { createdAt: query.status === 'pending' ? 1 : -1 },
      populate: [
        { path: 'user', select: 'name email roles' },
        { path: 'decidedBy', select: 'name' },
      ],
    }),
);

async function decide(
  req: Parameters<typeof authOf>[0],
  id: string,
  approve: boolean,
  note?: string,
) {
  const auth = authOf(req);
  const request = await RoleRequest.findById(id);
  if (!request) throw notFound('Role request not found');
  if (request.status !== 'pending') throw conflict(`This request was already ${request.status}`);
  const target = await User.findById(request.user);
  if (!target) throw notFound('The requesting user no longer exists');
  const role = request.role as Role;

  if (!canGrantRole(auth.roles, role)) throw forbidden(`Your role cannot grant ${ROLE_LABELS[role]}`);
  if (!target._id.equals(auth.userId) && !canManageUser(auth.roles, target.roles)) {
    throw forbidden('You cannot manage a user who outranks you');
  }

  // Claim the request atomically so two approvers can't act on it at once.
  const claimed = await RoleRequest.findOneAndUpdate(
    { _id: request._id, status: 'pending' },
    { $set: { status: approve ? 'approved' : 'rejected', decidedBy: auth.userId, decidedAt: new Date(), note } },
    { new: true },
  );
  if (!claimed) throw conflict('This request was just handled by someone else');

  let roles = target.roles;
  if (approve) {
    try {
      roles = await addRole(target._id, role);
    } catch (err) {
      await RoleRequest.updateOne({ _id: request._id }, { $set: { status: 'pending' }, $unset: { decidedBy: 1, decidedAt: 1, note: 1 } });
      throw err;
    }
  }
  audit(
    auth,
    { action: approve ? 'role_request.approve' : 'role_request.reject', resourceType: 'RoleRequest', resourceId: id, meta: { role, user: String(target._id) } },
    req,
  );
  return { request: claimed, roles };
}

defineRoute(
  roleRequestsRouter,
  base,
  {
    method: 'post',
    path: '/admin/role-requests/:id/approve',
    summary: 'Approve a role request (writes the role through to Keycloak)',
    tag: 'Roles',
    permissions: ['role:approve'],
    params: idParams,
    body: roleRequestDecision,
  },
  async ({ req, params, body }) => decide(req, params.id, true, body.note),
);

defineRoute(
  roleRequestsRouter,
  base,
  {
    method: 'post',
    path: '/admin/role-requests/:id/reject',
    summary: 'Reject a role request',
    tag: 'Roles',
    permissions: ['role:approve'],
    params: idParams,
    body: roleRequestDecision,
  },
  async ({ req, params, body }) => decide(req, params.id, false, body.note),
);
