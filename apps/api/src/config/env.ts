import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(8000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  OIDC_ISSUER: z.string().url(),
  OIDC_JWKS_URI: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  OIDC_AUDIENCE: z.string().default('medetherial-api'),
  /** Optional back-channel base URL for Keycloak (e.g. http://keycloak:8080 inside docker). */
  KEYCLOAK_INTERNAL_URL: z
    .string()
    .optional()
    .transform((v) => (v ? v.replace(/\/$/, '') : undefined)),
  KEYCLOAK_ADMIN_CLIENT_ID: z.string().default('medetherial-api-admin'),
  KEYCLOAK_ADMIN_CLIENT_SECRET: z.string().optional(),
  OSRM_URL: z.string().url().default('https://router.project-osrm.org'),
  CLINIC_TIMEZONE: z.string().default('Asia/Kolkata'),
  SIMULATOR_ENABLED: bool,
  SIMULATOR_TICK_MS: z.coerce.number().int().min(500).default(2000),
  SIMULATOR_AUTO_INCIDENTS: bool,
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    // Fail fast: misconfiguration must never reach production traffic.
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = load();
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
/** Base URL of the Keycloak server, derived from the issuer (…/realms/<realm>). */
export const keycloakBaseUrl = env.KEYCLOAK_INTERNAL_URL ?? env.OIDC_ISSUER.replace(/\/realms\/[^/]+\/?$/, '');
export const keycloakRealm = env.OIDC_ISSUER.match(/\/realms\/([^/]+)/)?.[1] ?? 'medetherial';
