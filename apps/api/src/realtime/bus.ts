import type {
  AmbulanceLocationEvent,
  ClientToServerEvents,
  HospitalAlertEvent,
  IncidentUpdateEvent,
  ServerToClientEvents,
} from '@medetherial/shared';
import type { Server } from 'socket.io';

/**
 * Thin decoupling layer: services publish domain events here; the Socket.IO server
 * (if attached) fans them out to authorised rooms. In tests nothing is attached.
 */
let io: Server<ClientToServerEvents, ServerToClientEvents> | undefined;

export function attachIo(server: Server<ClientToServerEvents, ServerToClientEvents>) {
  io = server;
}

export const rooms = {
  dispatch: 'dispatch',
  incident: (id: string) => `incident:${id}`,
  hospital: (id: string) => `hospital:${id}`,
  user: (sub: string) => `user:${sub}`,
  ambulance: (id: string) => `ambulance:${id}`,
};

export function publishAmbulanceLocation(e: AmbulanceLocationEvent) {
  if (!io) return;
  let target = io.to(rooms.dispatch).to(rooms.ambulance(e.ambulanceId));
  if (e.incidentId) target = target.to(rooms.incident(e.incidentId));
  target.emit('ambulance:location', e);
}

export function publishIncidentUpdate(e: IncidentUpdateEvent, opts: { isNew?: boolean } = {}) {
  if (!io) return;
  let target = io.to(rooms.dispatch).to(rooms.incident(e.incidentId));
  if (e.ambulanceId) target = target.to(rooms.ambulance(e.ambulanceId));
  if (e.hospitalId) target = target.to(rooms.hospital(e.hospitalId));
  target.emit(opts.isNew ? 'incident:new' : 'incident:update', e);
}

export function publishHospitalAlert(e: HospitalAlertEvent) {
  io?.to(rooms.hospital(e.hospitalId)).to(rooms.dispatch).emit('hospital:alert', e);
}
