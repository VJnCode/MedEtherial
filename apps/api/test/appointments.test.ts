import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, bearer, createDoctor, makeUser, useTestEnvironment } from './helpers.js';

useTestEnvironment();

/** A slot on the 30-minute grid two days ahead (doctor is available all week). */
function futureSlot(hoursAhead = 48) {
  const d = new Date(Date.now() + hoursAhead * 3600_000);
  d.setUTCMinutes(d.getUTCMinutes() < 30 ? 0 : 30, 0, 0);
  return d;
}

describe('appointments', () => {
  it('lists slots and books an appointment', async () => {
    const doc = await createDoctor(makeUser(['doctor'], 'Dr Who'));
    const patient = makeUser(['patient']);
    const date = futureSlot().toISOString().slice(0, 10);
    const slots = await request(app).get(`/api/v1/doctors/${doc.id}/slots?date=${date}`).set(await bearer(patient));
    expect(slots.status).toBe(200);
    expect(slots.body.length).toBeGreaterThan(10);

    const res = await request(app)
      .post('/api/v1/appointments')
      .set(await bearer(patient))
      .send({ doctorId: doc.id, startsAt: futureSlot().toISOString(), reason: 'Checkup' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('requested');
  });

  it('prevents double booking the same slot (409)', async () => {
    const doc = await createDoctor(makeUser(['doctor']));
    const startsAt = futureSlot().toISOString();
    const a = makeUser(['patient']);
    const b = makeUser(['patient']);
    const first = await request(app).post('/api/v1/appointments').set(await bearer(a)).send({ doctorId: doc.id, startsAt, reason: 'One' });
    expect(first.status).toBe(201);
    const second = await request(app).post('/api/v1/appointments').set(await bearer(b)).send({ doctorId: doc.id, startsAt, reason: 'Two' });
    expect(second.status).toBe(409);
  });

  it('frees the slot when cancelled', async () => {
    const doc = await createDoctor(makeUser(['doctor']));
    const startsAt = futureSlot().toISOString();
    const a = makeUser(['patient']);
    const appt = await request(app).post('/api/v1/appointments').set(await bearer(a)).send({ doctorId: doc.id, startsAt, reason: 'One' });
    const cancel = await request(app).patch(`/api/v1/appointments/${appt.body.id}/status`).set(await bearer(a)).send({ status: 'cancelled' });
    expect(cancel.status).toBe(200);
    const b = makeUser(['patient']);
    const again = await request(app).post('/api/v1/appointments').set(await bearer(b)).send({ doctorId: doc.id, startsAt, reason: 'Two' });
    expect(again.status).toBe(201);
  });

  it('rejects off-grid and past times', async () => {
    const doc = await createDoctor(makeUser(['doctor']));
    const p = makeUser(['patient']);
    const offGrid = new Date(futureSlot().getTime() + 7 * 60_000).toISOString();
    expect((await request(app).post('/api/v1/appointments').set(await bearer(p)).send({ doctorId: doc.id, startsAt: offGrid, reason: 'x x' })).status).toBe(400);
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect((await request(app).post('/api/v1/appointments').set(await bearer(p)).send({ doctorId: doc.id, startsAt: past, reason: 'x x' })).status).toBe(400);
  });

  it('only lets the treating doctor confirm, and enforces chart access', async () => {
    const drUser = makeUser(['doctor']);
    const doc = await createDoctor(drUser);
    const otherDr = makeUser(['doctor']);
    await createDoctor(otherDr);
    const p = makeUser(['patient']);
    const appt = await request(app).post('/api/v1/appointments').set(await bearer(p)).send({ doctorId: doc.id, startsAt: futureSlot().toISOString(), reason: 'Chest' });
    const patientId = appt.body.patient.id;

    expect((await request(app).patch(`/api/v1/appointments/${appt.body.id}/status`).set(await bearer(otherDr)).send({ status: 'confirmed' })).status).toBe(403);
    expect((await request(app).patch(`/api/v1/appointments/${appt.body.id}/status`).set(await bearer(p)).send({ status: 'confirmed' })).status).toBe(403);
    expect((await request(app).patch(`/api/v1/appointments/${appt.body.id}/status`).set(await bearer(drUser)).send({ status: 'confirmed' })).status).toBe(200);

    expect((await request(app).get(`/api/v1/patients/${patientId}`).set(await bearer(drUser))).status).toBe(200);
    expect((await request(app).get(`/api/v1/patients/${patientId}`).set(await bearer(otherDr))).status).toBe(403);

    const stranger = makeUser(['patient']);
    expect((await request(app).get(`/api/v1/patients/${patientId}/records`).set(await bearer(stranger))).status).toBe(403);
    expect((await request(app).get(`/api/v1/patients/${patientId}/records`).set(await bearer(p))).status).toBe(200);
  });

  it('lets the treating doctor prescribe; patient sees it', async () => {
    const drUser = makeUser(['doctor']);
    const doc = await createDoctor(drUser);
    const p = makeUser(['patient']);
    const appt = await request(app).post('/api/v1/appointments').set(await bearer(p)).send({ doctorId: doc.id, startsAt: futureSlot().toISOString(), reason: 'Cough' });
    const rx = await request(app)
      .post('/api/v1/prescriptions')
      .set(await bearer(drUser))
      .send({ patientId: appt.body.patient.id, medications: [{ name: 'Paracetamol', dosage: '500 mg', frequency: 'TID', durationDays: 3 }] });
    expect(rx.status).toBe(201);
    const mine = await request(app).get('/api/v1/prescriptions/mine').set(await bearer(p));
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].medications[0].name).toBe('Paracetamol');
  });
});
