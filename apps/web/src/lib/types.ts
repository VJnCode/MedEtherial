import type {
  AmbulanceStatus,
  AmbulanceType,
  AppointmentStatus,
  IncidentStatus,
  LatLng,
  Medication,
  Role,
  Severity,
  Vitals,
} from '@medetherial/shared';

export interface UserRef {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface Hospital {
  id: string;
  name: string;
  address: string;
  phone: string;
  position: LatLng;
  specialties: string[];
  erBedsTotal: number;
  erBedsAvailable: number;
  traumaCenter: boolean;
}

export interface Doctor {
  id: string;
  user: UserRef;
  specialty: string;
  hospital?: { id: string; name: string; address?: string };
  bio?: string;
  yearsExperience: number;
  consultationFee: number;
  rating: number;
  languages: string[];
  availability: { dayOfWeek: number; start: string; end: string }[];
  acceptingPatients: boolean;
}

export interface Patient {
  id: string;
  user: UserRef;
  mrn: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  phone?: string;
  address?: string;
  allergies: string[];
  conditions: string[];
  emergencyContacts: { name: string; relation?: string; phone: string }[];
}

export interface Appointment {
  id: string;
  patient: { id: string; mrn: string; user: UserRef };
  doctor: { id: string; specialty: string; user: UserRef; hospital?: { id: string; name: string } };
  startsAt: string;
  endsAt: string;
  reason: string;
  status: AppointmentStatus;
}

export interface Prescription {
  id: string;
  doctor?: { id: string; specialty: string; user: UserRef };
  medications: Medication[];
  notes?: string;
  issuedAt: string;
  validUntil?: string;
}

export interface Encounter {
  id: string;
  author?: UserRef;
  authorRole: string;
  type: string;
  summary: string;
  diagnosis?: string;
  vitals?: Vitals;
  createdAt: string;
}

export interface Ambulance {
  id: string;
  callsign: string;
  plate: string;
  type: AmbulanceType;
  status: AmbulanceStatus;
  crew: UserRef[];
  position: LatLng;
  heading?: number;
  speed?: number;
  lastSeenAt?: string;
  lastDevicePingAt?: string;
  currentIncident?: string;
  simulated: boolean;
}

export interface Incident {
  id: string;
  reference: string;
  status: IncidentStatus;
  severity: Severity;
  symptoms: string[];
  description?: string;
  address?: string;
  callerPhone?: string;
  position: LatLng;
  ambulancePosition?: LatLng;
  hospitalPosition?: LatLng;
  ambulance?: { id: string; callsign: string; type: AmbulanceType; plate: string; status: AmbulanceStatus; crew: UserRef[] };
  hospital?: { id: string; name: string; address: string; phone: string; erBedsAvailable: number };
  patient?: { id: string; mrn: string; bloodGroup?: string; allergies: string[]; conditions: string[]; user: UserRef };
  route?: [number, number][];
  routeDistanceMeters?: number;
  etaSeconds?: number;
  timeline: { status: IncidentStatus; at: string; note?: string; by?: UserRef | string }[];
  vitals: { at: string; vitals: Vitals }[];
  createdAt: string;
  onSceneAt?: string;
}

export interface Me {
  user: UserRef & { hospital?: { id: string; name: string } };
  roles: Role[];
  permissions: string[];
  patient: Patient | null;
  doctor: Doctor | null;
  ambulance: (Omit<Ambulance, 'position' | 'crew'> & { crew: string[] }) | null;
}

export interface Overview {
  fleet: Partial<Record<AmbulanceStatus, number>>;
  incidents: Partial<Record<IncidentStatus, number>>;
  responseTime: { avgSeconds: number | null; p90Seconds: number | null };
  erBeds: { total: number; available: number };
  daily: { date: string; total: number; critical: number }[];
  upcomingAppointments: number;
  users: number;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorName?: string;
  actorRoles: string[];
  action: string;
  resourceType: string;
  resourceId?: string;
  ip?: string;
  requestId?: string;
}

export interface AdminUser {
  id: string;
  sub: string;
  name: string;
  email?: string;
  roles: Role[];
  lastSeenAt?: string;
  hospital?: { id: string; name: string };
}
