import { isRole, permissionsFor, type Permission, type Role } from '@medetherial/shared';
import type { Types } from 'mongoose';
import { User } from '../models/user.model.js';
import { Patient, generateMrn } from '../models/patient.model.js';
import { logger } from '../lib/logger.js';
import { applyUserRoles, isBootstrapAdminEmail } from '../services/roles.service.js';
import { rolesFromClaims, type TokenClaims } from './verifier.js';

export interface AuthContext {
  sub: string;
  userId: Types.ObjectId;
  email?: string;
  name: string;
  roles: Role[];
  /** True when roles changed after this token was issued: the client should refresh its token. */
  rolesStale: boolean;
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
  /** Token-derived inputs: roles, issue time and e-mail state. */
  claimsKey: string;
  roles: Role[];
  rolesStale: boolean;
  at: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60_000;
const CACHE_MAX = 5_000;

export function clearAuthCache() {
  cache.clear();
}

const keyOf = (roles: readonly string[]) => [...roles].sort().join(',');

/**
 * Just-in-time provisioning: Keycloak is the source of truth for identity & roles.
 * We mirror the user into MongoDB so domain documents can reference it.
 *
 * When roles were changed server-side after the token was issued, the mirrored roles win
 * (so a revoked role stops working immediately) and `rolesStale` tells the client to refresh.
 */
export async function resolveAuthContext(claims: TokenClaims): Promise<AuthContext> {
  const tokenRoles = rolesFromClaims(claims).filter(isRole);
  const name =
    claims.name ??
    ([claims.given_name, claims.family_name].filter(Boolean).join(' ') ||
      claims.preferred_username ||
      claims.email ||
      'User');
  const rolesKey = keyOf(tokenRoles);
  const iat = claims.iat ?? 0;
  const claimsKey = `${rolesKey}|${iat}|${claims.email ?? ''}|${claims.email_verified === true}`;
  const cached = cache.get(claims.sub);

  if (cached && cached.claimsKey === claimsKey && Date.now() - cached.at < CACHE_TTL) {
    return build(claims, cached.userId, name, cached.roles, cached.rolesStale);
  }

  const user = await User.findOneAndUpdate(
    { sub: claims.sub },
    {
      $set: { email: claims.email, name, lastSeenAt: new Date() },
      $setOnInsert: { sub: claims.sub, roles: tokenRoles },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  let rolesStale = Boolean(user.rolesChangedAt && iat * 1000 < user.rolesChangedAt.getTime());
  let roles: Role[] = rolesStale ? user.roles.filter(isRole) : tokenRoles;
  if (!rolesStale && keyOf(user.roles) !== rolesKey) {
    user.roles = roles;
    await user.save();
  }

  // Configured platform owners get `admin` on their first verified sign-in (e.g. via Google).
  if (claims.email_verified === true && isBootstrapAdminEmail(claims.email) && !roles.includes('admin')) {
    try {
      roles = await applyUserRoles(user, [...roles, 'admin']);
      rolesStale = true;
      logger.info({ sub: claims.sub }, 'Granted admin to bootstrap administrator');
    } catch (err) {
      logger.error({ err, sub: claims.sub }, 'Could not grant bootstrap admin role');
    }
  }

  if (roles.includes('patient')) {
    await Patient.updateOne({ user: user._id }, { $setOnInsert: { user: user._id, mrn: generateMrn() } }, { upsert: true });
  }
  if (cache.size > CACHE_MAX) cache.clear();
  cache.set(claims.sub, { userId: user._id, claimsKey, roles, rolesStale, at: Date.now() });

  return build(claims, user._id, name, roles, rolesStale);
}

function build(claims: TokenClaims, userId: Types.ObjectId, name: string, roles: Role[], rolesStale: boolean): AuthContext {
  return { sub: claims.sub, userId, email: claims.email, name, roles, rolesStale, permissions: permissionsFor(roles) };
}
