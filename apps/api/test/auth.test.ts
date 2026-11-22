import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Patient, User } from '../src/models/index.js';
import { app, bearer, makeUser, tokenFor, useTestEnvironment } from './helpers.js';

useTestEnvironment();

describe('authentication & authorisation', () => {
  it('serves health without auth', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
  });

  it('rejects missing token with problem+json', async () => {
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('rejects token with wrong audience', async () => {
    const u = makeUser(['patient']);
    const token = await tokenFor(u, { audience: 'someone-else' });
    const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects garbage token', async () => {
    const res = await request(app).get('/api/v1/me').set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
  });

  it('provisions user and patient record just-in-time', async () => {
    const u = makeUser(['patient'], 'Jane Patient');
    const res = await request(app).get('/api/v1/me').set(await bearer(u));
    expect(res.status).toBe(200);
    expect(res.body.roles).toEqual(['patient']);
    expect(res.body.permissions).toContain('incident:create');
    expect(res.body.patient.mrn).toMatch(/^MRN-/);
    expect(await User.countDocuments({ sub: u.sub })).toBe(1);
    expect(await Patient.countDocuments()).toBe(1);
  });

  it('forbids patients from admin endpoints', async () => {
    const u = makeUser(['patient']);
    expect((await request(app).get('/api/v1/admin/users').set(await bearer(u))).status).toBe(403);
    expect((await request(app).get('/api/v1/stats/overview').set(await bearer(u))).status).toBe(403);
    expect((await request(app).get('/api/v1/ambulances').set(await bearer(u))).status).toBe(403);
  });

  it('allows admins into admin endpoints', async () => {
    const u = makeUser(['admin']);
    const res = await request(app).get('/api/v1/admin/users').set(await bearer(u));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it('validates request bodies (422)', async () => {
    const u = makeUser(['patient']);
    const res = await request(app).post('/api/v1/incidents').set(await bearer(u)).send({ symptoms: [] });
    expect(res.status).toBe(422);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('publishes an OpenAPI document', async () => {
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.paths['/api/v1/incidents']).toBeDefined();
  });
});
