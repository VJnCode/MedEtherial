import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Ambulance, Hospital, Incident } from '../src/models/index.js';
import { rankHospitals } from '../src/services/dispatch.service.js';
import { pointAlong } from '../src/simulator/simulator.js';
import { app, bearer, createAmbulance, createHospital, makeUser, persistUser, useTestEnvironment } from './helpers.js';

useTestEnvironment();

const SCENE = { lat: 12.3, lng: 76.64 };

describe('dispatch engine', () => {
  it('assigns the nearest ALS unit for critical cases, even if a BLS unit is closer', async () => {
    await createHospital('General', { lat: 12.31, lng: 76.65 });
    await createAmbulance('BLS-NEAR', 'BLS', { lat: 12.3005, lng: 76.6405 });
    const als = await createAmbulance('ALS-FAR', 'ALS', { lat: 12.32, lng: 76.66 });
    const p = makeUser(['patient']);
    const res = await request(app).post('/api/v1/incidents').set(await bearer(p)).send({ location: SCENE, symptoms: ['Cardiac arrest'] });
    expect(res.status).toBe(201);
    expect(res.body.severity).toBe('critical');
    expect(res.body.status).toBe('assigned');
    expect(res.body.ambulance.callsign).toBe('ALS-FAR');
    expect(res.body.etaSeconds).toBeGreaterThan(0);
    expect((await Ambulance.findById(als._id))!.status).toBe('dispatched');
  });

  it('uses the nearest unit of any type for non-critical cases', async () => {
    await createHospital('General', { lat: 12.31, lng: 76.65 });
    await createAmbulance('BLS-NEAR', 'BLS', { lat: 12.3005, lng: 76.6405 });
    await createAmbulance('ALS-FAR', 'ALS', { lat: 12.32, lng: 76.66 });
    const res = await request(app).post('/api/v1/incidents').set(await bearer(makeUser(['patient']))).send({ location: SCENE, symptoms: ['Fever'] });
    expect(res.body.ambulance.callsign).toBe('BLS-NEAR');
  });

  it('queues incidents when no unit is free and dispatches when one is released', async () => {
    await createHospital('General', { lat: 12.31, lng: 76.65 });
    const amb = await createAmbulance('ONLY-1', 'ALS', { lat: 12.3, lng: 76.65 });
    const crew = makeUser(['paramedic']);
    const crewDoc = await persistUser(crew);
    await Ambulance.updateOne({ _id: amb._id }, { $set: { crew: [crewDoc._id] } });

    const first = await request(app).post('/api/v1/incidents').set(await bearer(makeUser(['patient']))).send({ location: SCENE, symptoms: ['Chest pain'] });
    const second = await request(app).post('/api/v1/incidents').set(await bearer(makeUser(['patient']))).send({ location: SCENE, symptoms: ['Fall'] });
    expect(first.body.status).toBe('assigned');
    expect(second.body.status).toBe('requested');

    const h = await bearer(crew);
    for (const status of ['en_route', 'on_scene', 'transporting', 'at_hospital', 'closed']) {
      const r = await request(app).patch(`/api/v1/incidents/${first.body.id}/status`).set(h).send({ status });
      expect(r.status, status).toBe(200);
    }
    // dispatchPending runs asynchronously after release
    await new Promise((r) => setTimeout(r, 300));
    expect((await Incident.findById(second.body.id))!.status).toBe('assigned');
  });

  it('enforces the state machine and crew-only updates', async () => {
    await createHospital('General', { lat: 12.31, lng: 76.65 });
    await createAmbulance('A1', 'ALS', { lat: 12.3, lng: 76.65 });
    const p = makeUser(['patient']);
    const inc = await request(app).post('/api/v1/incidents').set(await bearer(p)).send({ location: SCENE, symptoms: ['Chest pain'] });

    // patient cannot drive the incident
    expect((await request(app).patch(`/api/v1/incidents/${inc.body.id}/status`).set(await bearer(p)).send({ status: 'en_route' })).status).toBe(403);
    // a paramedic who is not on the crew cannot see it at all
    expect((await request(app).patch(`/api/v1/incidents/${inc.body.id}/status`).set(await bearer(makeUser(['paramedic']))).send({ status: 'en_route' })).status).toBe(403);
    // dispatcher cannot skip states
    const d = await bearer(makeUser(['dispatcher']));
    expect((await request(app).patch(`/api/v1/incidents/${inc.body.id}/status`).set(d).send({ status: 'at_hospital' })).status).toBe(409);
    // patient may cancel their own request
    expect((await request(app).patch(`/api/v1/incidents/${inc.body.id}/status`).set(await bearer(p)).send({ status: 'cancelled' })).status).toBe(200);
    expect((await Ambulance.findOne({ callsign: 'A1' }))!.status).toBe('available');
  });

  it('decrements ER beds on arrival', async () => {
    const h = await createHospital('General', { lat: 12.31, lng: 76.65 }, { erBedsAvailable: 3 });
    await createAmbulance('A1', 'ALS', { lat: 12.3, lng: 76.65 });
    const inc = await request(app).post('/api/v1/incidents').set(await bearer(makeUser(['patient']))).send({ location: SCENE, symptoms: ['Chest pain'] });
    const d = await bearer(makeUser(['dispatcher']));
    for (const status of ['en_route', 'on_scene', 'transporting', 'at_hospital']) {
      await request(app).patch(`/api/v1/incidents/${inc.body.id}/status`).set(d).send({ status });
    }
    expect((await Hospital.findById(h._id))!.erBedsAvailable).toBe(2);
  });

  it('blocks a second active SOS from the same patient', async () => {
    await createAmbulance('A1', 'ALS', { lat: 12.3, lng: 76.65 });
    const p = makeUser(['patient']);
    const h = await bearer(p);
    expect((await request(app).post('/api/v1/incidents').set(h).send({ location: SCENE, symptoms: ['Fall'] })).status).toBe(201);
    expect((await request(app).post('/api/v1/incidents').set(h).send({ location: SCENE, symptoms: ['Fall'] })).status).toBe(409);
  });

  it('hides incidents from unrelated patients', async () => {
    await createAmbulance('A1', 'ALS', { lat: 12.3, lng: 76.65 });
    const inc = await request(app).post('/api/v1/incidents').set(await bearer(makeUser(['patient']))).send({ location: SCENE, symptoms: ['Fall'] });
    const other = await bearer(makeUser(['patient']));
    expect((await request(app).get(`/api/v1/incidents/${inc.body.id}`).set(other)).status).toBe(403);
    expect((await request(app).get('/api/v1/incidents').set(other)).body.total).toBe(0);
  });

  it('accepts GPS pings only from crew', async () => {
    const amb = await createAmbulance('A1', 'ALS', { lat: 12.3, lng: 76.65 });
    const crew = makeUser(['paramedic']);
    const crewDoc = await persistUser(crew);
    await Ambulance.updateOne({ _id: amb._id }, { $set: { crew: [crewDoc._id] } });
    const ping = { ambulanceId: amb.id, lat: 12.301, lng: 76.651, speed: 10 };
    expect((await request(app).post('/api/v1/tracking/ping').set(await bearer(makeUser(['paramedic']))).send(ping)).status).toBe(403);
    expect((await request(app).post('/api/v1/tracking/ping').set(await bearer(crew)).send(ping)).status).toBe(201);
    const updated = await Ambulance.findById(amb._id);
    expect(updated!.location.coordinates).toEqual([76.651, 12.301]);
    expect(updated!.lastDevicePingAt).toBeDefined();
  });
});

describe('pure helpers', () => {
  it('rankHospitals prefers trauma centres when trauma care is needed', () => {
    const near = { _id: 'a' as never, distance: 1000, traumaCenter: false, erBedsAvailable: 5, erBedsTotal: 10 };
    const trauma = { _id: 'b' as never, distance: 1400, traumaCenter: true, erBedsAvailable: 5, erBedsTotal: 10 };
    expect(rankHospitals([near, trauma], true)[0]).toBe(trauma);
    expect(rankHospitals([near, trauma], false)[0]).toBe(near);
  });

  it('pointAlong interpolates and reports completion', () => {
    const route: [number, number][] = [[12.3, 76.64], [12.31, 76.64]];
    const mid = pointAlong(route, 500);
    expect(mid.done).toBe(false);
    expect(mid.pos.lat).toBeGreaterThan(12.3);
    expect(pointAlong(route, 1e6).done).toBe(true);
  });
});
