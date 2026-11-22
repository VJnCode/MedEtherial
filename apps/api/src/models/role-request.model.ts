import { ROLES, ROLE_REQUEST_STATUSES } from '@medetherial/shared';
import { Schema, model, type InferSchemaType } from 'mongoose';
import { jsonOptions } from './common.js';

const roleRequestSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ROLES, required: true },
    reason: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ROLE_REQUEST_STATUSES, default: 'pending', required: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: Date,
    note: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, toJSON: jsonOptions },
);

// At most one open request per user and role.
roleRequestSchema.index({ user: 1, role: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
roleRequestSchema.index({ status: 1, createdAt: -1 });

export type RoleRequestDoc = InferSchemaType<typeof roleRequestSchema>;
export const RoleRequest = model('RoleRequest', roleRequestSchema);
