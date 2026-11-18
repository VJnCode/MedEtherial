import type { Permission, Role } from '@medetherial/shared';
import type { Request, RequestHandler } from 'express';
import { forbidden, unauthorized } from '../lib/errors.js';
import { resolveAuthContext, type AuthContext } from './context.js';
import { getVerifier } from './verifier.js';

export function extractBearer(header?: string): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = extractBearer(req.headers.authorization);
  if (!token) return next(unauthorized());
  try {
    const claims = await getVerifier()(token);
    req.auth = await resolveAuthContext(claims);
    next();
  } catch (err) {
    if (err instanceof Error && /mongo|buffering/i.test(err.message)) return next(err);
    next(unauthorized('Invalid or expired access token'));
  }
};

export const requirePermission =
  (...perms: Permission[]): RequestHandler =>
  (req, _res, next) => {
    const auth = req.auth;
    if (!auth) return next(unauthorized());
    if (perms.some((p) => auth.permissions.has(p))) return next();
    next(forbidden());
  };

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    const auth = req.auth;
    if (!auth) return next(unauthorized());
    if (roles.some((r) => auth.roles.includes(r))) return next();
    next(forbidden());
  };

export function authOf(req: Request): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}

export const can = (auth: AuthContext, p: Permission) => auth.permissions.has(p);
