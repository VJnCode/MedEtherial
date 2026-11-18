import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'e2e-only-secret-not-for-production-0123456789',
      AUTH_TRUST_HOST: 'true',
      AUTH_KEYCLOAK_ID: process.env.AUTH_KEYCLOAK_ID ?? 'medetherial-web',
      AUTH_KEYCLOAK_SECRET: process.env.AUTH_KEYCLOAK_SECRET ?? 'e2e',
      AUTH_KEYCLOAK_ISSUER: process.env.AUTH_KEYCLOAK_ISSUER ?? 'http://localhost:8080/realms/medetherial',
    },
  },
});
