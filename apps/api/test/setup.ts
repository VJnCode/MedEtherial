// Runs before any test module is imported, so env validation sees these values.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.MONGODB_URI ??= 'mongodb://placeholder/test';
process.env.OIDC_ISSUER = 'https://auth.test.local/realms/medetherial';
process.env.OIDC_AUDIENCE = 'medetherial-api';
process.env.SIMULATOR_ENABLED = 'false';
