import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb, syncIndexes } from './db.js';
import { logger } from './lib/logger.js';
import { createSocketServer } from './realtime/socket.js';
import { dispatchPending } from './services/dispatch.service.js';
import { startSimulator } from './simulator/simulator.js';

async function main() {
  await connectDb();
  await syncIndexes();

  const app = createApp();
  const http = createServer(app);
  const io = createSocketServer(http);
  const stopSim = startSimulator();

  // Safety net: periodically retry dispatch for queued incidents.
  const queueTimer = setInterval(() => {
    dispatchPending().catch((err: unknown) => logger.error({ err }, 'dispatch queue failed'));
  }, 15_000);

  http.listen(env.PORT, () => logger.info(`API listening on :${env.PORT}`));

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down gracefully');
    clearInterval(queueTimer);
    stopSim();
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled rejection'));
}

main().catch((err: unknown) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
