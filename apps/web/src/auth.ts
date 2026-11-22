import { isRole, type Role } from '@medetherial/shared';
import NextAuth, { type DefaultSession } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Keycloak from 'next-auth/providers/keycloak';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    roles: Role[];
    error?: 'RefreshTokenError';
    user: { id: string } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    expiresAt?: number;
    roles?: Role[];
    error?: 'RefreshTokenError';
  }
}

/** Decodes realm roles from a Keycloak access token (display only — the API verifies signatures). */
export function rolesFromAccessToken(token?: string): Role[] {
  if (!token) return [];
  try {
    // Edge-safe base64url decode (middleware runs on the Edge runtime).
    const b64 = (token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
    const json = new TextDecoder().decode(Uint8Array.from(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')), (c) => c.charCodeAt(0)));
    const payload = JSON.parse(json) as {
      realm_access?: { roles?: string[] };
    };
    return (payload.realm_access?.roles ?? []).filter(isRole);
  } catch {
    return [];
  }
}

const issuer = process.env.AUTH_KEYCLOAK_ISSUER;

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    if (!token.refreshToken) throw new Error('No refresh token');
    const res = await fetch(`${issuer}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.AUTH_KEYCLOAK_ID ?? '',
        client_secret: process.env.AUTH_KEYCLOAK_SECRET ?? '',
        refresh_token: token.refreshToken,
      }),
    });
    const body = (await res.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
      id_token?: string;
    };
    if (!res.ok) throw body;
    return {
      ...token,
      accessToken: body.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + body.expires_in,
      // Keycloak rotates refresh tokens — always keep the newest one.
      refreshToken: body.refresh_token ?? token.refreshToken,
      idToken: body.id_token ?? token.idToken,
      roles: rolesFromAccessToken(body.access_token),
      error: undefined,
    };
  } catch {
    return { ...token, error: 'RefreshTokenError' };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
      issuer,
      // Authorization Code + PKCE + state
      checks: ['pkce', 'state'],
    }),
  ],
  session: { strategy: 'jwt', maxAge: 10 * 60 * 60 },
  pages: { signIn: '/login', error: '/login' },
  trustHost: true,
  callbacks: {
    async jwt({ token, account, trigger }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          idToken: account.id_token,
          expiresAt: account.expires_at,
          roles: rolesFromAccessToken(account.access_token),
        };
      }
      // The client asks for a fresh token after its roles change (see RoleSync).
      if (trigger === 'update') return refreshAccessToken(token);
      // Refresh 30s before expiry.
      if (token.expiresAt && Date.now() < token.expiresAt * 1000 - 30_000) return token;
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.roles = token.roles ?? [];
      session.error = token.error;
      session.user.id = token.sub ?? '';
      return session;
    },
  },
});
