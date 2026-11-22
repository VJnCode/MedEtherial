import type { Role } from '@medetherial/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoleRequest } from '../src/models/index.js';
import { app, bearer, makeUser, persistUser, tokenFor, useTestEnvironment, type TestUser } from './helpers.js';

/** In-memory stand-in for the Keycloak Admin REST API. */
const kcRoles = vi.hoisted(() => new Map<string, Role[]>());
vi.mock('../src/services/keycloak-admin.service.js', () => ({
  getUserRealmRoles: async (sub: string) => kcRoles.get(sub) ?? [],
  setUserRealmRoles: async (sub: string, roles: Role[]) => {
    kcRoles.set(sub, [...roles]);
    return [...roles];
  },
  logoutUserSessions: async () => undefined,
}));

useTestEnvironment();
beforeEach(() => kcRoles.clear());

async function register(u: TestUser, extra: Record<string, unknown> = {}) {
  kcRoles.set(u.sub, [...u.roles]);
  return persistUser(u, extra);
}

const post = async (u: TestUser, path: string, body: object = {}) =>
  request(app).post(`/api/v1${path}`).set(await bearer(u)).send(body);

describe('role requests & hierarchy', () => {
  it('grants patient instantly but queues other roles for approval', async () => {
    const d = makeUser(['doctor']);
    await register(d);
    const patient = await post(d, '/me/role-requests', { role: 'patient' });
    expect(patient.status).toBe(201);
    expect(patient.body.granted).toBe(true);
    expect(kcRoles.get(d.sub)).toEqual(['doctor', 'patient']);

    const p = makeUser(['patient']);
    await register(p);
    const res = await post(p, '/me/role-requests', { role: 'doctor', reason: 'MBBS, KMC 12345' });
    expect(res.status).toBe(201);
    expect(res.body.granted).toBe(false);
    expect(res.body.request.status).toBe('pending');
    expect(kcRoles.get(p.sub)).toEqual(['patient']);

    const dup = await post(p, '/me/role-requests', { role: 'doctor' });
    expect(dup.status).toBe(409);
  });

  it('lets an admin approve; tokens issued before the change use the new roles and are flagged stale', async () => {
    const admin = makeUser(['admin'], 'Admin');
    const p = makeUser(['patient'], 'Applicant');
    await register(admin);
    await register(p);
    const oldToken = await tokenFor(p);
    const created = await request(app)
      .post('/api/v1/me/role-requests')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ role: 'paramedic' });
    const id = created.body.request.id as string;

    const queue = await request(app).get('/api/v1/admin/role-requests').set(await bearer(admin));
    expect(queue.status).toBe(200);
    expect(queue.body.items).toHaveLength(1);
    expect(queue.body.items[0].user.name).toBe('Applicant');

    await new Promise((r) => setTimeout(r, 1100)); // rolesChangedAt has second resolution, like `iat`
    const ok = await post(admin, `/admin/role-requests/${id}/approve`);
    expect(ok.status).toBe(201);
    expect(ok.body.roles).toEqual(['patient', 'paramedic']);
    expect(kcRoles.get(p.sub)).toEqual(['patient', 'paramedic']);

    const me = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${oldToken}`);
    expect(me.body.rolesStale).toBe(true);
    expect(me.body.roles).toEqual(['patient', 'paramedic']);
    expect(me.body.permissions).toContain('location:publish');

    const again = await post(admin, `/admin/role-requests/${id}/approve`);
    expect(again.status).toBe(409);
  });

  it('forbids non-admins from approving', async () => {
    const hospital = makeUser(['hospital_admin']);
    const p = makeUser(['patient']);
    await register(hospital);
    await register(p);
    const created = await post(p, '/me/role-requests', { role: 'doctor' });
    const res = await post(hospital, `/admin/role-requests/${created.body.request.id}/approve`);
    expect(res.status).toBe(403);
    expect((await RoleRequest.findById(created.body.request.id))?.status).toBe('pending');
  });

  it('rejects requests and lets users withdraw their own', async () => {
    const admin = makeUser(['admin']);
    const p = makeUser(['patient']);
    await register(admin);
    await register(p);
    const a = await post(p, '/me/role-requests', { role: 'dispatcher' });
    const rej = await post(admin, `/admin/role-requests/${a.body.request.id}/reject`, { note: 'Not on the rota' });
    expect(rej.body.request.status).toBe('rejected');
    expect(kcRoles.get(p.sub)).toEqual(['patient']);

    const b = await post(p, '/me/role-requests', { role: 'dispatcher' });
    const del = await request(app).delete(`/api/v1/me/role-requests/${b.body.request.id}`).set(await bearer(p));
    expect(del.body.status).toBe('cancelled');
  });

  it('lets users drop a role but keeps at least one', async () => {
    const u = makeUser(['patient', 'doctor']);
    await register(u);
    const drop = await request(app).delete('/api/v1/me/roles/doctor').set(await bearer(u));
    expect(drop.status).toBe(200);
    expect(drop.body.roles).toEqual(['patient']);
    const last = await request(app).delete('/api/v1/me/roles/patient').set(await bearer(u));
    expect(last.status).toBe(400);
  });

  it('stops admins from removing their own admin role', async () => {
    const admin = makeUser(['admin']);
    const user = await register(admin);
    const res = await request(app).put(`/api/v1/admin/users/${user.id}/roles`).set(await bearer(admin)).send({ roles: ['patient'] });
    expect(res.status).toBe(403);
  });

  it('grants admin to a configured owner only once their e-mail is verified', async () => {
    const owner = makeUser(['patient'], 'Owner');
    kcRoles.set(owner.sub, ['patient']);
    const unverified = await tokenFor(owner, { claims: { email: 'owner@test.local', email_verified: false } });
    const r1 = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${unverified}`);
    expect(r1.body.roles).toEqual(['patient']);

    const verified = await tokenFor(owner, { claims: { email: 'Owner@test.local', email_verified: true } });
    const r2 = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${verified}`);
    expect(r2.body.roles).toEqual(['patient', 'admin']);
    expect(r2.body.rolesStale).toBe(true);
    expect(kcRoles.get(owner.sub)).toEqual(['patient', 'admin']);

    const drop = await request(app).delete('/api/v1/me/roles/admin').set('Authorization', `Bearer ${verified}`);
    expect(drop.status).toBe(403);
  });
});
