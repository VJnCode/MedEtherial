import type { Request } from 'express';
import type { AuthContext } from '../auth/context.js';
import { logger } from '../lib/logger.js';
import { AuditLog } from '../models/index.js';

export interface AuditEntry {
  action: string;
  resourceType: string;
  resourceId?: string;
  meta?: Record<string, unknown>;
}

/** Fire-and-forget audit write. Failures are logged but never break the request. */
export function audit(auth: AuthContext | undefined, entry: AuditEntry, req?: Request) {
  AuditLog.create({
    actor: auth?.userId,
    actorName: auth?.name ?? 'system',
    actorRoles: auth?.roles ?? [],
    ...entry,
    ip: req?.ip,
    userAgent: req?.get('user-agent'),
    requestId: req?.id ? String(req.id) : undefined,
  }).catch((err: unknown) => logger.error({ err }, 'Failed to write audit log'));
}
