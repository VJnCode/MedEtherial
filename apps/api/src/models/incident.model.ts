import { INCIDENT_STATUSES, SEVERITIES } from '@medetherial/shared';
import { randomBytes } from 'node:crypto';
import { Schema, model, type InferSchemaType } from 'mongoose';
import { jsonOptions, pointSchema, vitalsSchema } from './common.js';

export function generateIncidentRef(): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `INC-${ymd}-${randomBytes(2).toString('hex').toUpperCase()}`;
}

const timelineSchema = new Schema(
  {
    status: { type: String, enum: INCIDENT_STATUSES, required: true },
    at: { type: Date, default: () => new Date() },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    note: String,
  },
  { _id: false },
);

const vitalsEntrySchema = new Schema(
  {
    at: { type: Date, default: () => new Date() },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    vitals: vitalsSchema,
  },
  { _id: false },
);

const incidentSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', index: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    callerPhone: String,
    location: { type: pointSchema, required: true },
    address: String,
    symptoms: { type: [String], required: true },
    description: String,
    severity: { type: String, enum: SEVERITIES, required: true },
    status: { type: String, enum: INCIDENT_STATUSES, default: 'requested', index: true },
    timeline: { type: [timelineSchema], default: [] },
    vitals: { type: [vitalsEntrySchema], default: [] },
    ambulance: { type: Schema.Types.ObjectId, ref: 'Ambulance', index: true },
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', index: true },
    /** Route currently being driven, as [lat, lng] pairs. */
    route: { type: Schema.Types.Mixed, default: undefined },
    routeDistanceMeters: Number,
    etaSeconds: Number,
    assignedAt: Date,
    onSceneAt: Date,
    atHospitalAt: Date,
    closedAt: Date,
  },
  { timestamps: true, toJSON: jsonOptions },
);

incidentSchema.index({ status: 1, createdAt: -1 });
incidentSchema.index({ location: '2dsphere' });

export type IncidentDoc = InferSchemaType<typeof incidentSchema>;
export const Incident = model('Incident', incidentSchema);
