import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { env } from '../config/env.js';

export interface TokenClaims extends JWTPayload {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  realm_access?: { roles?: string[] };
}

export type TokenVerifier = (token: string) => Promise<TokenClaims>;

export function createVerifier(opts: {
  issuer: string;
  audience: string;
  keys: JWTVerifyGetKey;
}): TokenVerifier {
  return async (token) => {
    const { payload } = await jwtVerify(token, opts.keys, {
      issuer: opts.issuer,
      audience: opts.audience,
      algorithms: ['RS256', 'ES256', 'PS256'],
      clockTolerance: 5,
    });
    if (!payload.sub) throw new Error('Token has no subject');
    return payload as TokenClaims;
  };
}

let verifier: TokenVerifier | undefined;

export function getVerifier(): TokenVerifier {
  if (!verifier) {
    const jwksUri = env.OIDC_JWKS_URI ?? `${env.OIDC_ISSUER}/protocol/openid-connect/certs`;
    verifier = createVerifier({
      issuer: env.OIDC_ISSUER,
      audience: env.OIDC_AUDIENCE,
      keys: createRemoteJWKSet(new URL(jwksUri), { cooldownDuration: 30_000, cacheMaxAge: 10 * 60_000 }),
    });
  }
  return verifier;
}

/** Test hook — inject a verifier backed by a local key set. */
export function setVerifier(v: TokenVerifier) {
  verifier = v;
}

export function rolesFromClaims(claims: TokenClaims): string[] {
  return claims.realm_access?.roles ?? [];
}
