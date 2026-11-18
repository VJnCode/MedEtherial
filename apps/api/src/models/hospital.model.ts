import { Schema, model, type InferSchemaType } from 'mongoose';
import { jsonOptions, pointSchema } from './common.js';

const hospitalSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    location: { type: pointSchema, required: true },
    specialties: { type: [String], default: [] },
    erBedsTotal: { type: Number, required: true, min: 0 },
    erBedsAvailable: { type: Number, required: true, min: 0 },
    traumaCenter: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: jsonOptions },
);

hospitalSchema.index({ location: '2dsphere' });

export type HospitalDoc = InferSchemaType<typeof hospitalSchema>;
export const Hospital = model('Hospital', hospitalSchema);
