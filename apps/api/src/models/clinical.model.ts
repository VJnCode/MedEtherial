import { ENCOUNTER_TYPES } from '@medetherial/shared';
import { Schema, model, type InferSchemaType } from 'mongoose';
import { jsonOptions, vitalsSchema } from './common.js';

const medicationSchema = new Schema(
  {
    name: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: { type: String, required: true },
    durationDays: { type: Number, required: true },
    instructions: String,
  },
  { _id: false },
);

const prescriptionSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    medications: { type: [medicationSchema], required: true },
    notes: String,
    issuedAt: { type: Date, default: () => new Date() },
    validUntil: Date,
  },
  { timestamps: true, toJSON: jsonOptions },
);

export type PrescriptionDoc = InferSchemaType<typeof prescriptionSchema>;
export const Prescription = model('Prescription', prescriptionSchema);

const encounterSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: { type: String, required: true },
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    incident: { type: Schema.Types.ObjectId, ref: 'Incident' },
    type: { type: String, enum: ENCOUNTER_TYPES, required: true },
    summary: { type: String, required: true },
    diagnosis: String,
    vitals: vitalsSchema,
  },
  { timestamps: true, toJSON: jsonOptions },
);
encounterSchema.index({ patient: 1, createdAt: -1 });

export type EncounterDoc = InferSchemaType<typeof encounterSchema>;
export const Encounter = model('Encounter', encounterSchema);
