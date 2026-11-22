import { BLOOD_GROUPS } from '@medetherial/shared';
import { randomInt } from 'node:crypto';
import { Schema, model, type InferSchemaType } from 'mongoose';
import { jsonOptions } from './common.js';

export function generateMrn(): string {
  return `MRN-${new Date().getFullYear()}-${randomInt(100000, 999999)}`;
}

const contactSchema = new Schema(
  { name: { type: String, required: true }, relation: String, phone: { type: String, required: true } },
  { _id: false },
);

const patientSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    mrn: { type: String, required: true, unique: true },
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female', 'other', 'undisclosed'] },
    bloodGroup: { type: String, enum: BLOOD_GROUPS },
    phone: String,
    address: String,
    allergies: { type: [String], default: [] },
    conditions: { type: [String], default: [] },
    emergencyContacts: { type: [contactSchema], default: [] },
  },
  { timestamps: true, toJSON: jsonOptions },
);

export type PatientDoc = InferSchemaType<typeof patientSchema>;
export const Patient = model('Patient', patientSchema);
