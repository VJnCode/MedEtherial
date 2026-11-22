import { Schema, model, type InferSchemaType } from 'mongoose';
import { jsonOptions } from './common.js';

const availabilitySchema = new Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false },
);

const doctorSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    specialty: { type: String, required: true, index: true },
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', index: true },
    licenseNo: String,
    bio: String,
    yearsExperience: { type: Number, default: 0 },
    consultationFee: { type: Number, default: 0 },
    rating: { type: Number, min: 0, max: 5, default: 4.5 },
    languages: { type: [String], default: ['English'] },
    availability: { type: [availabilitySchema], default: [] },
    acceptingPatients: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: jsonOptions },
);

export type DoctorDoc = InferSchemaType<typeof doctorSchema>;
export const Doctor = model('Doctor', doctorSchema);
