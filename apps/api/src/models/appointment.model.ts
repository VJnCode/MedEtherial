import { APPOINTMENT_STATUSES } from '@medetherial/shared';
import { Schema, model, type InferSchemaType } from 'mongoose';
import { jsonOptions } from './common.js';

const historySchema = new Schema(
  {
    status: { type: String, enum: APPOINTMENT_STATUSES, required: true },
    at: { type: Date, default: () => new Date() },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    note: String,
  },
  { _id: false },
);

const appointmentSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'requested' },
    /** true while the slot is held (requested/confirmed) — enforces no double-booking via unique partial index. */
    holdsSlot: { type: Boolean, default: true },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true, toJSON: jsonOptions },
);

appointmentSchema.index(
  { doctor: 1, startsAt: 1 },
  { unique: true, partialFilterExpression: { holdsSlot: true }, name: 'uniq_doctor_slot' },
);
appointmentSchema.index({ patient: 1, startsAt: -1 });

export type AppointmentDoc = InferSchemaType<typeof appointmentSchema>;
export const Appointment = model('Appointment', appointmentSchema);
