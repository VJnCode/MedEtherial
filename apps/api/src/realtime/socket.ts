import { locationPing, type ClientToServerEvents, type ServerToClientEvents } from '@medetherial/shared';
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { corsOrigin } from '../app.js';
import { resolveAuthContext, type AuthContext } from '../auth/context.js';
import { getVerifier } from '../auth/verifier.js';
import { logger } from '../lib/logger.js';
import { ambulanceOf, assertIncidentAccess, hospitalIdOf } from '../services/access.service.js';
import { ingestLocation } from '../services/dispatch.service.js';
import { attachIo, rooms } from './bus.js';

interface SocketData {
  auth: AuthContext;
}

export function createSocketServer(http: HttpServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(http, {
    cors: { origin: corsOrigin, credentials: true },
    path: '/socket.io',
    pingInterval: 20_000,
    pingTimeout: 20_000,
    connectionStateRecovery: { maxDisconnectionDuration: 60_000 },
  });

  // OIDC bearer token is verified on the handshake — same rules as REST.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('unauthorized'));
      const claims = await getVerifier()(token);
      socket.data.auth = await resolveAuthContext(claims);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const auth = socket.data.auth;
    await socket.join(rooms.user(auth.sub));
    if (auth.permissions.has('incident:read:all')) await socket.join(rooms.dispatch);
    if (auth.roles.includes('doctor') || auth.roles.includes('hospital_admin')) {
      const hid = await hospitalIdOf(auth);
      if (hid) await socket.join(rooms.hospital(String(hid)));
    }
    if (auth.roles.includes('paramedic')) {
      const amb = await ambulanceOf(auth);
      if (amb) await socket.join(rooms.ambulance(String(amb._id)));
    }
    logger.debug({ sub: auth.sub, rooms: [...socket.rooms] }, 'socket connected');

    socket.on('incident:watch', async (incidentId, ack) => {
      try {
        if (typeof incidentId !== 'string' || !/^[a-f\d]{24}$/i.test(incidentId)) throw new Error('invalid id');
        await assertIncidentAccess(auth, incidentId);
        await socket.join(rooms.incident(incidentId));
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    });

    socket.on('incident:unwatch', (incidentId) => {
      void socket.leave(rooms.incident(String(incidentId)));
    });

    socket.on('location:publish', async (ping, ack) => {
      try {
        if (!auth.permissions.has('location:publish')) throw new Error('forbidden');
        await ingestLocation(locationPing.parse(ping), 'device', auth);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    });
  });

  attachIo(io);
  return io;
}
