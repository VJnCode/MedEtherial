import { AMBULANCE_STATUSES, AMBULANCE_TYPES } from '@medetherial/shared';
import { Schema, model, type InferSchemaType } from 'mongoose';
import { jsonOptions, pointSchema } from './common.js';

const ambulanceSchema = new Schema(
  {
    callsign: { type: String, required: true, unique: true, uppercase: true, trim: true },
    plate: { type: String, required: true },
    type: { type: String, enum: AMBULANCE_TYPES, required: true },
    status: { type: String, enum: AMBULANCE_STATUSES, default: 'available', index: true },
    crew: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    baseHospital: { type: Schema.Types.ObjectId, ref: 'Hospital' },
    location: { type: pointSchema, required: true },
    heading: Number,
    speed: Number,
    lastSeenAt: Date,
    /** Last time a real device (not the simulator) reported a position. */
    lastDevicePingAt: Date,
    currentIncident: { type: Schema.Types.ObjectId, ref: 'Incident' },
    /** Driven by the built-in simulator when no real device is reporting. */
    simulated: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: jsonOptions },
);

ambulanceSchema.index({ location: '2dsphere' });
ambulanceSchema.index({ crew: 1 });

export type AmbulanceDoc = InferSchemaType<typeof ambulanceSchema>;
export const Ambulance = model('Ambulance', ambulanceSchema);
