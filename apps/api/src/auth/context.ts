import { isRole, permissionsFor, type Permission, type Role } from '@medetherial/shared';
import type { Types } from 'mongoose';
import { User } from '../models/user.model.js';
import { Patient, generateMrn } from '../models/patient.model.js';
import { rolesFromClaims, type TokenClaims } from './verifier.js';

export interface AuthContext {
  sub: string;
  userId: Types.ObjectId;
  email?: string;
  name: string;
  roles: Role[];
  permissions: Set<Permission>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

interface CacheEntry {
  userId: Types.ObjectId;
  rolesKey: string;
  at: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60_000;
const CACHE_MAX = 5_000;

export function clearAuthCache() {
  cache.clear();
}

/**
 * Just-in-time provisioning: Keycloak is the source of truth for identity & roles.
 * We mirror the user into MongoDB so domain documents can reference it.
 */
export async function resolveAuthContext(claims: TokenClaims): Promise<AuthContext> {
  const roles = rolesFromClaims(claims).filter(isRole);
  const name =
    claims.name ??
    ([claims.given_name, claims.family_name].filter(Boolean).join(' ') ||
      claims.preferred_username ||
      claims.email ||
      'User');
  const rolesKey = [...roles].sort().join(',');
  const cached = cache.get(claims.sub);

  let userId: Types.ObjectId;
  if (cached && cached.rolesKey === rolesKey && Date.now() - cached.at < CACHE_TTL) {
    userId = cached.userId;
  } else {
    const user = await User.findOneAndUpdate(
      { sub: claims.sub },
      {
        $set: { email: claims.email, name, roles, lastSeenAt: new Date() },
        $setOnInsert: { sub: claims.sub },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    userId = user._id;
    if (roles.includes('patient')) {
      await Patient.updateOne(
        { user: userId },
        { $setOnInsert: { user: userId, mrn: generateMrn() } },
        { upsert: true },
      );
    }
    if (cache.size > CACHE_MAX) cache.clear();
    cache.set(claims.sub, { userId, rolesKey, at: Date.now() });
  }

  return { sub: claims.sub, userId, email: claims.email, name, roles, permissions: permissionsFor(roles) };
}
