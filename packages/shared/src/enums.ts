export const APPOINTMENT_STATUSES = ['requested', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const INCIDENT_STATUSES = [
  'requested',
  'assigned',
  'en_route',
  'on_scene',
  'transporting',
  'at_hospital',
  'closed',
  'cancelled',
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const SEVERITIES = ['low', 'moderate', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const AMBULANCE_STATUSES = ['available', 'dispatched', 'busy', 'offline', 'maintenance'] as const;
export type AmbulanceStatus = (typeof AMBULANCE_STATUSES)[number];

export const AMBULANCE_TYPES = ['BLS', 'ALS'] as const;
export type AmbulanceType = (typeof AMBULANCE_TYPES)[number];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

/** Allowed incident transitions (state machine). */
export const INCIDENT_TRANSITIONS: Record<IncidentStatus, readonly IncidentStatus[]> = {
  requested: ['assigned', 'cancelled'],
  assigned: ['en_route', 'cancelled'],
  en_route: ['on_scene', 'cancelled'],
  on_scene: ['transporting', 'closed'],
  transporting: ['at_hospital'],
  at_hospital: ['closed'],
  closed: [],
  cancelled: [],
};

export function canTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  return INCIDENT_TRANSITIONS[from].includes(to);
}

export const ACTIVE_INCIDENT_STATUSES: readonly IncidentStatus[] = [
  'requested',
  'assigned',
  'en_route',
  'on_scene',
  'transporting',
];

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  requested: 'Requested',
  assigned: 'Ambulance assigned',
  en_route: 'En route to patient',
  on_scene: 'On scene',
  transporting: 'Transporting to hospital',
  at_hospital: 'Arrived at hospital',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  requested: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function canTransitionAppointment(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return APPOINTMENT_TRANSITIONS[from].includes(to);
}

export const SLOT_MINUTES = 30;

export const ROLE_REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type RoleRequestStatus = (typeof ROLE_REQUEST_STATUSES)[number];
