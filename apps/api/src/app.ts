import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env, isTest } from './config/env.js';
import { errorHandler, notFoundHandler } from './lib/errors.js';
import { logger } from './lib/logger.js';
import { buildOpenApi } from './lib/route.js';
import { adminRouter } from './routes/admin.routes.js';
import { appointmentsRouter } from './routes/appointments.routes.js';
import { doctorsRouter } from './routes/doctors.routes.js';
import { fleetRouter } from './routes/fleet.routes.js';
import { hospitalsRouter } from './routes/hospitals.routes.js';
import { incidentsRouter } from './routes/incidents.routes.js';
import { meRouter } from './routes/me.routes.js';
import { patientsRouter } from './routes/patients.routes.js';

export function corsOrigin(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) {
  // Non-browser clients (curl, server-to-server) send no Origin header.
  if (!origin) return cb(null, true);
  const allowed = env.CORS_ORIGINS.some((o) =>
    o.startsWith('*.') ? origin.endsWith(o.slice(1)) && origin.startsWith('https://') : o === origin,
  );
  cb(null, allowed);
}

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  // Render / Vercel sit behind a single proxy hop.
  app.set('trust proxy', 1);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' },
      quietReqLogger: true,
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // swagger-ui needs inline styles/scripts on /docs only
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cors({ origin: corsOrigin, credentials: true, maxAge: 600 }));
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));

  if (!isTest) {
    app.use(
      '/api',
      rateLimit({
        windowMs: 60_000,
        limit: 300,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { status: 429, title: 'Too Many Requests', detail: 'Rate limit exceeded' },
      }),
    );
    app.use(
      '/api/v1/incidents',
      rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }),
    );
  }

  app.get('/', (_req, res) => {
    res.json({ name: 'MedEtherial API', version: '1.0.0', docs: '/docs', health: '/healthz' });
  });
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });
  app.get('/readyz', (_req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', db: mongoose.connection.readyState });
  });

  app.use('/api/v1/me', meRouter);
  app.use('/api/v1/doctors', doctorsRouter);
  app.use('/api/v1/appointments', appointmentsRouter);
  app.use('/api/v1/hospitals', hospitalsRouter);
  app.use('/api/v1/incidents', incidentsRouter);
  app.use('/api/v1', patientsRouter);
  app.use('/api/v1', fleetRouter);
  app.use('/api/v1', adminRouter);

  const spec = buildOpenApi('/');
  app.get('/openapi.json', (_req, res) => {
    res.json(spec);
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'MedEtherial API' }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
