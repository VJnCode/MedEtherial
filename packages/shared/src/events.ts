import type { AmbulanceStatus, IncidentStatus, Severity } from './enums.js';
import type { LatLng } from './schemas.js';

export interface AmbulanceLocationEvent {
  ambulanceId: string;
  callsign: string;
  status: AmbulanceStatus;
  location: LatLng;
  heading?: number;
  speed?: number;
  incidentId?: string;
  etaSeconds?: number;
  at: string;
}

export interface IncidentUpdateEvent {
  incidentId: string;
  reference: string;
  status: IncidentStatus;
  severity: Severity;
  ambulanceId?: string;
  hospitalId?: string;
  etaSeconds?: number;
  /** [lat, lng] pairs */
  route?: [number, number][];
  at: string;
}

export interface HospitalAlertEvent {
  incidentId: string;
  reference: string;
  hospitalId: string;
  severity: Severity;
  etaSeconds?: number;
  patientSummary: string;
  at: string;
}

export interface ServerToClientEvents {
  'ambulance:location': (e: AmbulanceLocationEvent) => void;
  'incident:update': (e: IncidentUpdateEvent) => void;
  'incident:new': (e: IncidentUpdateEvent) => void;
  'hospital:alert': (e: HospitalAlertEvent) => void;
}

export type Ack = (res: { ok: boolean; error?: string }) => void;

export interface ClientToServerEvents {
  'incident:watch': (incidentId: string, ack: Ack) => void;
  'incident:unwatch': (incidentId: string) => void;
  'location:publish': (
    ping: {
      ambulanceId: string;
      lat: number;
      lng: number;
      heading?: number;
      speed?: number;
      accuracy?: number;
    },
    ack?: Ack,
  ) => void;
}
