import { Schema } from 'mongoose';

/** GeoJSON Point sub-schema ([lng, lat]). */
export const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (v: number[]) => v.length === 2 && Math.abs(v[0]!) <= 180 && Math.abs(v[1]!) <= 90,
        message: 'coordinates must be [lng, lat]',
      },
    },
  },
  { _id: false },
);

export const vitalsSchema = new Schema(
  {
    heartRate: Number,
    systolic: Number,
    diastolic: Number,
    spo2: Number,
    respiratoryRate: Number,
    temperature: Number,
    gcs: Number,
  },
  { _id: false },
);

/** Strip internal fields from JSON output. */
export const jsonOptions = {
  virtuals: true,
  versionKey: false,
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
};
