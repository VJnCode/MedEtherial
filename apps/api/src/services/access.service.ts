import type { Types } from 'mongoose';
import type { AuthContext } from '../auth/context.js';
import { forbidden } from '../lib/errors.js';
import { Ambulance, Appointment, Doctor, Incident, Patient, User } from '../models/index.js';

/** Resolves the caller's Patient id (if any). */
export async function patientIdOf(auth: AuthContext): Promise<Types.ObjectId | undefined> {
  const p = await Patient.findOne({ user: auth.userId }, { _id: 1 }).lean();
  return p?._id;
}

export async function doctorOf(auth: AuthContext) {
  return Doctor.findOne({ user: auth.userId });
}

/** Hospital the caller is affiliated with (doctor profile or user affiliation). */
export async function hospitalIdOf(auth: AuthContext): Promise<Types.ObjectId | undefined> {
  if (auth.roles.includes('doctor')) {
    const d = await Doctor.findOne({ user: auth.userId }, { hospital: 1 }).lean();
    if (d?.hospital) return d.hospital;
  }
  const u = await User.findById(auth.userId, { hospital: 1 }).lean();
  return u?.hospital ?? undefined;
}

export async function ambulanceOf(auth: AuthContext) {
  return Ambulance.findOne({ crew: auth.userId });
}

/**
 * Object-level authorisation for patient data (PHI).
 * - patients: only themselves
 * - doctors: patients they have an appointment with, or emergency patients routed to their hospital
 * - paramedics: patients on an incident assigned to their ambulance
 * - admin: everyone
 */
export async function assertPatientAccess(auth: AuthContext, patientId: Types.ObjectId | string) {
  if (auth.roles.includes('admin')) return;
  const pid = String(patientId);

  if (auth.roles.includes('patient')) {
    const own = await patientIdOf(auth);
    if (own && String(own) === pid) return;
  }
  if (auth.roles.includes('doctor')) {
    const doctor = await doctorOf(auth);
    if (doctor) {
      const linked = await Appointment.exists({ doctor: doctor._id, patient: pid });
      if (linked) return;
      if (doctor.hospital && (await Incident.exists({ patient: pid, hospital: doctor.hospital }))) return;
    }
  }
  if (auth.roles.includes('paramedic')) {
    const amb = await ambulanceOf(auth);
    if (amb && (await Incident.exists({ patient: pid, ambulance: amb._id }))) return;
  }
  throw forbidden('You are not authorised to access this patient');
}

/** Builds a Mongo filter restricting incidents to those the caller may see. */
export async function incidentScope(auth: AuthContext): Promise<Record<string, unknown> | null> {
  if (auth.permissions.has('incident:read:all')) return {};
  const or: Record<string, unknown>[] = [];
  if (auth.permissions.has('incident:read:self')) {
    const pid = await patientIdOf(auth);
    or.push({ reportedBy: auth.userId });
    if (pid) or.push({ patient: pid });
  }
  if (auth.permissions.has('incident:read:assigned')) {
    if (auth.roles.includes('paramedic')) {
      const amb = await ambulanceOf(auth);
      if (amb) or.push({ ambulance: amb._id });
    }
    if (auth.roles.includes('doctor') || auth.roles.includes('hospital_admin')) {
      const hid = await hospitalIdOf(auth);
      if (hid) or.push({ hospital: hid });
    }
  }
  return or.length ? { $or: or } : null;
}

export async function assertIncidentAccess(auth: AuthContext, incidentId: string) {
  const scope = await incidentScope(auth);
  if (scope && (await Incident.exists({ _id: incidentId, ...scope }))) return;
  throw forbidden('You are not authorised to access this incident');
}
