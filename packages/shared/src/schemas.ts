import { z } from 'zod';
import {
  AMBULANCE_STATUSES,
  AMBULANCE_TYPES,
  APPOINTMENT_STATUSES,
  BLOOD_GROUPS,
  INCIDENT_STATUSES,
  SEVERITIES,
} from './enums.js';
import { ROLES } from './rbac.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const latLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof latLng>;

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const vitalsSchema = z.object({
  heartRate: z.number().int().min(0).max(300).optional(),
  systolic: z.number().int().min(0).max(300).optional(),
  diastolic: z.number().int().min(0).max(200).optional(),
  spo2: z.number().min(0).max(100).optional(),
  respiratoryRate: z.number().int().min(0).max(80).optional(),
  temperature: z.number().min(25).max(45).optional(),
  gcs: z.number().int().min(3).max(15).optional(),
});
export type Vitals = z.infer<typeof vitalsSchema>;

export const emergencyContactSchema = z.object({
  name: z.string().min(1).max(100),
  relation: z.string().max(50).optional(),
  phone: z.string().min(5).max(20),
});

export const patientProfileUpdate = z.object({
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(['male', 'female', 'other', 'undisclosed']).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  phone: z.string().min(5).max(20).optional(),
  address: z.string().max(300).optional(),
  allergies: z.array(z.string().max(100)).max(50).optional(),
  conditions: z.array(z.string().max(100)).max(50).optional(),
  emergencyContacts: z.array(emergencyContactSchema).max(5).optional(),
});
export type PatientProfileUpdate = z.infer<typeof patientProfileUpdate>;

export const availabilityWindow = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});
export const availabilitySchema = z.array(availabilityWindow).max(28);

export const createAppointment = z.object({
  doctorId: objectId,
  startsAt: z.coerce.date(),
  reason: z.string().min(3).max(500),
});
export type CreateAppointment = z.infer<typeof createAppointment>;

export const updateAppointmentStatus = z.object({
  status: z.enum(APPOINTMENT_STATUSES),
  note: z.string().max(500).optional(),
});

export const medicationSchema = z.object({
  name: z.string().min(1).max(120),
  dosage: z.string().min(1).max(60),
  frequency: z.string().min(1).max(60),
  durationDays: z.number().int().min(1).max(365),
  instructions: z.string().max(300).optional(),
});
export type Medication = z.infer<typeof medicationSchema>;

export const createPrescription = z.object({
  patientId: objectId,
  appointmentId: objectId.optional(),
  medications: z.array(medicationSchema).min(1).max(20),
  notes: z.string().max(1000).optional(),
});
export type CreatePrescription = z.infer<typeof createPrescription>;

export const ENCOUNTER_TYPES = ['consultation', 'emergency', 'follow_up', 'prehospital'] as const;
export const createEncounter = z.object({
  patientId: objectId,
  appointmentId: objectId.optional(),
  incidentId: objectId.optional(),
  type: z.enum(ENCOUNTER_TYPES),
  summary: z.string().min(1).max(4000),
  diagnosis: z.string().max(500).optional(),
  vitals: vitalsSchema.optional(),
});
export type CreateEncounter = z.infer<typeof createEncounter>;

export const createIncident = z.object({
  location: latLng,
  address: z.string().max(300).optional(),
  symptoms: z.array(z.string().max(60)).min(1).max(20),
  description: z.string().max(1000).optional(),
  vitals: vitalsSchema.optional(),
  /** Dispatcher may raise on behalf of a patient. */
  patientId: objectId.optional(),
  callerPhone: z.string().max(20).optional(),
});
export type CreateIncident = z.infer<typeof createIncident>;

export const updateIncidentStatus = z.object({
  status: z.enum(INCIDENT_STATUSES),
  note: z.string().max(500).optional(),
});

export const assignIncident = z.object({
  ambulanceId: objectId.optional(),
  hospitalId: objectId.optional(),
});

export const locationPing = latLng.extend({
  ambulanceId: objectId,
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).max(100).optional(),
  accuracy: z.number().min(0).max(10000).optional(),
});
export type LocationPingInput = z.infer<typeof locationPing>;

export const createHospital = z.object({
  name: z.string().min(2).max(160),
  address: z.string().max(300),
  phone: z.string().max(20),
  location: latLng,
  specialties: z.array(z.string().max(60)).max(40).default([]),
  erBedsTotal: z.number().int().min(0).max(1000),
  erBedsAvailable: z.number().int().min(0).max(1000),
  traumaCenter: z.boolean().default(false),
});

export const updateHospitalCapacity = z.object({
  erBedsAvailable: z.number().int().min(0).max(1000),
});

export const createAmbulance = z.object({
  callsign: z.string().min(2).max(20),
  type: z.enum(AMBULANCE_TYPES),
  plate: z.string().min(2).max(20),
  baseHospitalId: objectId.optional(),
  location: latLng,
});

export const updateAmbulance = z.object({
  status: z.enum(AMBULANCE_STATUSES).optional(),
  crew: z.array(objectId).max(4).optional(),
});

export const updateUserRoles = z.object({
  roles: z.array(z.enum(ROLES)).min(1),
});

export const roleRequestCreate = z.object({
  role: z.enum(ROLES),
  reason: z.string().trim().max(500).optional(),
});

export const roleRequestDecision = z.object({
  note: z.string().trim().max(500).optional(),
});

export const severitySchema = z.enum(SEVERITIES);
