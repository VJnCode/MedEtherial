import { createEncounter, createPrescription, pagination } from '@medetherial/shared';
import { Router } from 'express';
import { z } from 'zod';
import { authOf } from '../auth/middleware.js';
import { forbidden, notFound } from '../lib/errors.js';
import { paginate } from '../lib/paginate.js';
import { defineRoute, idParams } from '../lib/route.js';
import { Appointment, Encounter, Incident, Patient, Prescription, User } from '../models/index.js';
import { ambulanceOf, assertPatientAccess, doctorOf, patientIdOf } from '../services/access.service.js';
import { audit } from '../services/audit.service.js';

export const patientsRouter = Router();
const base = '/api/v1';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

defineRoute(
  patientsRouter,
  base,
  {
    method: 'get',
    path: '/patients',
    summary: 'Patients under the caller’s care (doctor) or all (admin)',
    tag: 'Patients',
    permissions: ['record:read:assigned', 'user:manage'],
    query: pagination.extend({ q: z.string().max(80).optional() }),
  },
  async ({ req, query }) => {
    const auth = authOf(req);
    const filter: Record<string, unknown> = {};
    if (!auth.roles.includes('admin')) {
      const doctor = await doctorOf(auth);
      if (!doctor) return { items: [], page: 1, limit: query.limit, total: 0, pages: 1 };
      const ids = await Appointment.distinct('patient', { doctor: doctor._id });
      const emergencyIds = doctor.hospital ? await Incident.distinct('patient', { hospital: doctor.hospital }) : [];
      filter._id = { $in: [...ids, ...emergencyIds] };
    }
    if (query.q) {
      const users = await User.find({ name: new RegExp(escapeRegex(query.q), 'i') }, { _id: 1 }).lean();
      filter.$or = [{ user: { $in: users.map((u) => u._id) } }, { mrn: new RegExp(escapeRegex(query.q), 'i') }];
    }
    return paginate(Patient, filter, { ...query, populate: { path: 'user', select: 'name email' } });
  },
);

defineRoute(
  patientsRouter,
  base,
  {
    method: 'get',
    path: '/patients/:id',
    summary: 'Patient chart summary',
    tag: 'Patients',
    permissions: ['record:read:assigned', 'record:read:self', 'user:manage'],
    params: idParams,
  },
  async ({ req, params }) => {
    const auth = authOf(req);
    await assertPatientAccess(auth, params.id);
    const patient = await Patient.findById(params.id).populate('user', 'name email phone');
    if (!patient) throw notFound('Patient not found');
    audit(auth, { action: 'patient.chart.view', resourceType: 'Patient', resourceId: params.id }, req);
    return patient;
  },
);

defineRoute(
  patientsRouter,
  base,
  {
    method: 'get',
    path: '/patients/:id/records',
    summary: 'Clinical timeline: encounters, prescriptions, emergencies',
    tag: 'Patients',
    permissions: ['record:read:assigned', 'record:read:self', 'user:manage'],
    params: idParams,
  },
  async ({ req, params }) => {
    const auth = authOf(req);
    await assertPatientAccess(auth, params.id);
    const [encounters, prescriptions, incidents] = await Promise.all([
      Encounter.find({ patient: params.id }).sort({ createdAt: -1 }).limit(100).populate('author', 'name'),
      Prescription.find({ patient: params.id })
        .sort({ issuedAt: -1 })
        .limit(100)
        .populate({ path: 'doctor', select: 'specialty user', populate: { path: 'user', select: 'name' } }),
      Incident.find({ patient: params.id }, { route: 0 }).sort({ createdAt: -1 }).limit(20).populate('hospital', 'name'),
    ]);
    audit(auth, { action: 'patient.records.view', resourceType: 'Patient', resourceId: params.id }, req);
    return { encounters, prescriptions, incidents };
  },
);

defineRoute(
  patientsRouter,
  base,
  {
    method: 'get',
    path: '/prescriptions/mine',
    summary: 'Own prescriptions (patients)',
    tag: 'Clinical',
    permissions: ['record:read:self'],
  },
  async ({ req }) => {
    const pid = await patientIdOf(authOf(req));
    if (!pid) return [];
    return Prescription.find({ patient: pid })
      .sort({ issuedAt: -1 })
      .populate({ path: 'doctor', select: 'specialty user', populate: { path: 'user', select: 'name' } });
  },
);

defineRoute(
  patientsRouter,
  base,
  {
    method: 'post',
    path: '/prescriptions',
    summary: 'Issue a prescription (doctors)',
    tag: 'Clinical',
    permissions: ['prescription:write'],
    body: createPrescription,
  },
  async ({ req, body }) => {
    const auth = authOf(req);
    const doctor = await doctorOf(auth);
    if (!doctor) throw forbidden('No doctor profile linked to this account');
    await assertPatientAccess(auth, body.patientId);
    const maxDays = Math.max(...body.medications.map((m) => m.durationDays));
    const rx = await Prescription.create({
      patient: body.patientId,
      doctor: doctor._id,
      appointment: body.appointmentId,
      medications: body.medications,
      notes: body.notes,
      issuedAt: new Date(),
      validUntil: new Date(Date.now() + maxDays * 86_400_000),
    });
    audit(auth, { action: 'prescription.create', resourceType: 'Prescription', resourceId: String(rx._id), meta: { patient: body.patientId } }, req);
    return rx;
  },
);

defineRoute(
  patientsRouter,
  base,
  {
    method: 'post',
    path: '/encounters',
    summary: 'Write a clinical note (doctors, paramedics)',
    tag: 'Clinical',
    permissions: ['record:write'],
    body: createEncounter,
  },
  async ({ req, body }) => {
    const auth = authOf(req);
    if (auth.roles.includes('paramedic') && !auth.roles.includes('doctor')) {
      // Paramedics may only document pre-hospital care on their own incidents.
      const amb = await ambulanceOf(auth);
      if (!body.incidentId || !amb || !(await Incident.exists({ _id: body.incidentId, ambulance: amb._id }))) {
        throw forbidden('Paramedics can only document their assigned incidents');
      }
    } else {
      await assertPatientAccess(auth, body.patientId);
    }
    const enc = await Encounter.create({
      patient: body.patientId,
      author: auth.userId,
      authorRole: auth.roles.includes('doctor') ? 'doctor' : 'paramedic',
      appointment: body.appointmentId,
      incident: body.incidentId,
      type: body.type,
      summary: body.summary,
      diagnosis: body.diagnosis,
      vitals: body.vitals,
    });
    audit(auth, { action: 'encounter.create', resourceType: 'Encounter', resourceId: String(enc._id), meta: { patient: body.patientId } }, req);
    return enc;
  },
);
