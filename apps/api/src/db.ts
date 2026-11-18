import mongoose from 'mongoose';
import { env, isProd } from './config/env.js';
import { logger } from './lib/logger.js';

mongoose.set('strictQuery', true);

export async function connectDb(uri = env.MONGODB_URI) {
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 20,
    // Index builds are done by the seed/migration step in production.
    autoIndex: !isProd,
    appName: 'medetherial-api',
  });
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
}

/** Ensures indexes (incl. 2dsphere + unique partial indexes) and time-series collections exist. */
export async function syncIndexes() {
  for (const name of mongoose.modelNames()) {
    const model = mongoose.model(name);
    await model.createCollection().catch(() => undefined);
    await model.syncIndexes();
  }
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
