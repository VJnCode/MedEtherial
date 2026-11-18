import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';

/**
 * Builds the Keycloak RP-initiated logout URL (OIDC end_session_endpoint) so that
 * signing out of MedEtherial also ends the SSO session at the identity provider.
 */
export async function GET(req: NextRequest) {
  const secureCookie = req.nextUrl.protocol === 'https:';
  const token = await getToken({ req, secret: process.env.AUTH_SECRET, secureCookie });
  const origin = process.env.AUTH_URL ?? req.nextUrl.origin;
  const issuer = process.env.AUTH_KEYCLOAK_ISSUER;
  if (!issuer) return NextResponse.json({ url: origin });

  const url = new URL(`${issuer}/protocol/openid-connect/logout`);
  url.searchParams.set('post_logout_redirect_uri', `${origin}/`);
  url.searchParams.set('client_id', process.env.AUTH_KEYCLOAK_ID ?? '');
  if (token?.idToken) url.searchParams.set('id_token_hint', token.idToken as string);
  return NextResponse.json({ url: url.toString() });
}
