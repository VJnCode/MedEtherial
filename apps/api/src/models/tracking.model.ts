import { Schema, model } from 'mongoose';
import { pointSchema } from './common.js';

/**
 * Raw GPS breadcrumbs stored in a MongoDB time-series collection.
 * Auto-expire after 7 days to bound storage (PHI minimisation).
 */
const locationPingSchema = new Schema(
  {
    at: { type: Date, required: true },
    meta: {
      ambulance: { type: Schema.Types.ObjectId, ref: 'Ambulance', required: true },
      incident: { type: Schema.Types.ObjectId, ref: 'Incident' },
      source: { type: String, enum: ['device', 'simulator'], required: true },
    },
    location: { type: pointSchema, required: true },
    heading: Number,
    speed: Number,
    accuracy: Number,
  },
  {
    timeseries: { timeField: 'at', metaField: 'meta', granularity: 'seconds' },
    expireAfterSeconds: 7 * 24 * 3600,
    versionKey: false,
  },
);

export const LocationPing = model('LocationPing', locationPingSchema);

const auditLogSchema = new Schema(
  {
    at: { type: Date, default: () => new Date(), index: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: String,
    actorRoles: [String],
    action: { type: String, required: true, index: true },
    resourceType: { type: String, required: true },
    resourceId: String,
    ip: String,
    userAgent: String,
    requestId: String,
    meta: Schema.Types.Mixed,
  },
  { versionKey: false, toJSON: { virtuals: true, versionKey: false } },
);
auditLogSchema.index({ resourceType: 1, resourceId: 1, at: -1 });

/** Append-only audit trail. Updates/deletes are blocked at the model layer. */
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'] as const) {
  auditLogSchema.pre(op, function () {
    throw new Error('AuditLog is append-only');
  });
}

export const AuditLog = model('AuditLog', auditLogSchema);
