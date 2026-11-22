import { ROLES, type Role } from '@medetherial/shared';
import { env, keycloakBaseUrl, keycloakRealm } from '../config/env.js';
import { HttpError } from '../lib/errors.js';

/**
 * Minimal Keycloak Admin REST client using a confidential service-account
 * (client_credentials grant). Keycloak remains the source of truth for roles.
 */
let cached: { token: string; exp: number } | undefined;

async function adminToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 10_000) return cached.token;
  if (!env.KEYCLOAK_ADMIN_CLIENT_SECRET) throw new HttpError(503, 'Keycloak admin client is not configured');
  const res = await fetch(`${keycloakBaseUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.KEYCLOAK_ADMIN_CLIENT_ID,
      client_secret: env.KEYCLOAK_ADMIN_CLIENT_SECRET,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new HttpError(502, `Keycloak token request failed (${res.status})`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, exp: Date.now() + body.expires_in * 1000 };
  return cached.token;
}

async function kc<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${keycloakBaseUrl}/admin/realms/${keycloakRealm}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await adminToken()}`, 'Content-Type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new HttpError(res.status === 404 ? 404 : 502, `Keycloak admin API error (${res.status})`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

interface KcRole {
  id: string;
  name: string;
}

export async function getUserRealmRoles(sub: string): Promise<Role[]> {
  const roles = await kc<KcRole[]>(`/users/${sub}/role-mappings/realm`);
  return roles.map((r) => r.name).filter((n): n is Role => (ROLES as readonly string[]).includes(n));
}

/** Replaces the managed application roles of a user, leaving Keycloak default roles untouched. */
export async function setUserRealmRoles(sub: string, roles: Role[]): Promise<Role[]> {
  const all = await kc<KcRole[]>('/roles');
  const managed = all.filter((r) => (ROLES as readonly string[]).includes(r.name));
  const current = await kc<KcRole[]>(`/users/${sub}/role-mappings/realm`);
  const currentManaged = current.filter((r) => (ROLES as readonly string[]).includes(r.name));

  const toAdd = managed.filter((r) => roles.includes(r.name as Role) && !currentManaged.some((c) => c.id === r.id));
  const toRemove = currentManaged.filter((r) => !roles.includes(r.name as Role));

  if (toAdd.length) await kc(`/users/${sub}/role-mappings/realm`, { method: 'POST', body: JSON.stringify(toAdd) });
  if (toRemove.length) await kc(`/users/${sub}/role-mappings/realm`, { method: 'DELETE', body: JSON.stringify(toRemove) });
  return getUserRealmRoles(sub);
}

export async function logoutUserSessions(sub: string) {
  await kc(`/users/${sub}/logout`, { method: 'POST' });
}
