import { ROLES } from '@medetherial/shared';
import { Schema, model, type InferSchemaType } from 'mongoose';
import { jsonOptions } from './common.js';

const userSchema = new Schema(
  {
    /** Keycloak subject — the stable identity key. */
    sub: { type: String, required: true, unique: true, index: true },
    email: { type: String, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    roles: [{ type: String, enum: ROLES }],
    phone: String,
    avatarUrl: String,
    /** Affiliation for hospital admins / paramedics. Doctors carry it on their Doctor profile. */
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital' },
    active: { type: Boolean, default: true },
    lastSeenAt: Date,
  },
  { timestamps: true, toJSON: jsonOptions },
);

userSchema.index({ roles: 1 });
userSchema.index({ name: 'text', email: 'text' });

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model('User', userSchema);
