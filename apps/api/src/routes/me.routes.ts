import { availabilitySchema, patientProfileUpdate } from '@medetherial/shared';
import { Router } from 'express';
import { z } from 'zod';
import { authOf } from '../auth/middleware.js';
import { forbidden } from '../lib/errors.js';
import { defineRoute } from '../lib/route.js';
import { Ambulance, Doctor, Patient, User } from '../models/index.js';
import { audit } from '../services/audit.service.js';

export const meRouter = Router();
const base = '/api/v1/me';

defineRoute(meRouter, base, { method: 'get', path: '/', summary: 'Current user profile, roles and linked records', tag: 'Me' }, async ({ req }) => {
  const auth = authOf(req);
  const [user, patient, doctor, ambulance] = await Promise.all([
    User.findById(auth.userId).populate('hospital', 'name'),
    auth.roles.includes('patient') ? Patient.findOne({ user: auth.userId }) : null,
    auth.roles.includes('doctor') ? Doctor.findOne({ user: auth.userId }).populate('hospital', 'name address') : null,
    auth.roles.includes('paramedic') ? Ambulance.findOne({ crew: auth.userId }) : null,
  ]);
  return {
    user,
    roles: auth.roles,
    rolesStale: auth.rolesStale,
    permissions: [...auth.permissions],
    patient,
    doctor,
    ambulance,
  };
});

defineRoute(
  meRouter,
  base,
  {
    method: 'patch',
    path: '/patient',
    summary: 'Update own patient profile (demographics, allergies, emergency contacts)',
    tag: 'Me',
    permissions: ['profile:write:self'],
    body: patientProfileUpdate,
  },
  async ({ req, body }) => {
    const auth = authOf(req);
    if (!auth.roles.includes('patient')) throw forbidden('Only patients have a patient profile');
    const patient = await Patient.findOneAndUpdate({ user: auth.userId }, { $set: body }, { new: true, runValidators: true });
    audit(auth, { action: 'patient.profile.update', resourceType: 'Patient', resourceId: String(patient?._id) }, req);
    return patient;
  },
);

defineRoute(
  meRouter,
  base,
  {
    method: 'put',
    path: '/availability',
    summary: 'Replace own weekly availability (doctors)',
    tag: 'Me',
    permissions: ['appointment:manage'],
    body: z.object({ availability: availabilitySchema, acceptingPatients: z.boolean().optional() }),
  },
  async ({ req, body }) => {
    const auth = authOf(req);
    for (const w of body.availability) if (w.start >= w.end) throw forbidden(`Invalid window ${w.start}-${w.end}`);
    const doctor = await Doctor.findOneAndUpdate(
      { user: auth.userId },
      { $set: { availability: body.availability, ...(body.acceptingPatients !== undefined ? { acceptingPatients: body.acceptingPatients } : {}) } },
      { new: true },
    );
    if (!doctor) throw forbidden('No doctor profile linked to this account');
    return doctor;
  },
);
