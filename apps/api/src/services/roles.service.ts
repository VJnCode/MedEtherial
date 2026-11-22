import { isRole, type Role } from '@medetherial/shared';
import type { HydratedDocument } from 'mongoose';
import { clearAuthCache } from '../auth/context.js';
import { env } from '../config/env.js';
import { Doctor, User, type UserDoc } from '../models/index.js';
import { getUserRealmRoles, setUserRealmRoles } from './keycloak-admin.service.js';

type UserDocument = HydratedDocument<UserDoc>;

export function isBootstrapAdminEmail(email?: string | null): boolean {
  return Boolean(email && env.BOOTSTRAP_ADMIN_EMAILS.includes(email.toLowerCase()));
}

/** Second-resolution timestamp, comparable with a JWT `iat`. */
const nowToSecond = () => new Date(Math.floor(Date.now() / 1000) * 1000);

/**
 * Writes the user's roles to Keycloak (source of truth) and mirrors them into MongoDB.
 * Tokens issued before this call are treated as stale by the auth layer.
 */
export async function applyUserRoles(user: UserDocument, roles: Role[]): Promise<Role[]> {
  const unique = [...new Set(roles)].filter(isRole);
  const saved = await setUserRealmRoles(user.sub, unique);
  user.roles = saved;
  user.rolesChangedAt = nowToSecond();
  await user.save();
  if (saved.includes('doctor')) {
    await Doctor.updateOne({ user: user._id }, { $setOnInsert: { user: user._id, specialty: 'General Medicine' } }, { upsert: true });
  }
  clearAuthCache();
  return saved;
}

/** Current roles as Keycloak sees them (falls back to the mirror if Keycloak is unreachable). */
export async function currentRolesOf(user: UserDocument): Promise<Role[]> {
  try {
    return await getUserRealmRoles(user.sub);
  } catch {
    return user.roles.filter(isRole);
  }
}

export async function addRole(userId: unknown, role: Role): Promise<Role[]> {
  const user = await User.findById(userId).orFail();
  const roles = await currentRolesOf(user);
  if (roles.includes(role)) return roles;
  return applyUserRoles(user, [...roles, role]);
}
