/* eslint-disable no-console */
/**
 * Registers (or updates) "Sign in with Google" on the MedEtherial Keycloak realm.
 *
 * Realm import only runs when the realm is first created, so existing deployments
 * (local docker, Render) need this one-off, idempotent call.
 *
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... pnpm --filter @medetherial/api keycloak:google
 *
 * Env: OIDC_ISSUER (realm URL), KEYCLOAK_INTERNAL_URL (optional), KC_ADMIN_USERNAME / KC_ADMIN_PASSWORD
 * (Keycloak master-realm admin; default admin/admin for local docker).
 *
 * In Google Cloud Console → Credentials → OAuth client (Web application), add the redirect URI that
 * this script prints.
 */
const issuer = process.env.OIDC_ISSUER ?? 'http://localhost:8080/realms/medetherial';
const realm = issuer.match(/\/realms\/([^/]+)/)?.[1] ?? 'medetherial';
const publicBase = issuer.replace(/\/realms\/[^/]+\/?$/, '');
const base = (process.env.KEYCLOAK_INTERNAL_URL || publicBase).replace(/\/$/, '');
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const adminUser = process.env.KC_ADMIN_USERNAME ?? 'admin';
const adminPassword = process.env.KC_ADMIN_PASSWORD ?? 'admin';

async function main() {
  if (!clientId || !clientSecret) {
    throw new Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (Google Cloud Console → APIs & Services → Credentials).');
  }

  const tokenRes = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: adminUser, password: adminPassword }),
  });
  if (!tokenRes.ok) throw new Error(`Keycloak admin login failed (${tokenRes.status}). Check KC_ADMIN_USERNAME / KC_ADMIN_PASSWORD.`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const headers = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };
  const idpUrl = `${base}/admin/realms/${realm}/identity-provider/instances`;

  const idp = {
    alias: 'google',
    providerId: 'google',
    displayName: 'Google',
    enabled: true,
    // Google verifies addresses, so brokered users arrive with email_verified=true.
    trustEmail: true,
    storeToken: false,
    addReadTokenRoleOnCreate: false,
    firstBrokerLoginFlowAlias: 'first broker login',
    config: {
      clientId,
      clientSecret,
      defaultScope: 'openid email profile',
      syncMode: 'IMPORT',
      guiOrder: '1',
      prompt: 'select_account',
    },
  };

  const existing = await fetch(`${idpUrl}/google`, { headers });
  const res = existing.ok
    ? await fetch(`${idpUrl}/google`, { method: 'PUT', headers, body: JSON.stringify(idp) })
    : await fetch(idpUrl, { method: 'POST', headers, body: JSON.stringify(idp) });
  if (!res.ok) throw new Error(`Saving the Google identity provider failed (${res.status}): ${await res.text()}`);

  console.log(`✓ Google sign-in ${existing.ok ? 'updated' : 'enabled'} on realm "${realm}".`);
  console.log(`  Authorised redirect URI for the Google OAuth client:\n  ${publicBase}/realms/${realm}/broker/google/endpoint`);
}

main().catch((err: unknown) => {
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
