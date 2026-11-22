export const ROLES = ['patient', 'doctor', 'paramedic', 'dispatcher', 'hospital_admin', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'profile:read:self',
  'profile:write:self',
  'appointment:create',
  'appointment:read:self',
  'appointment:read:assigned',
  'appointment:manage',
  'record:read:self',
  'record:read:assigned',
  'record:write',
  'prescription:write',
  'incident:create',
  'incident:read:self',
  'incident:read:assigned',
  'incident:read:all',
  'incident:dispatch',
  'incident:update_status',
  'location:publish',
  'fleet:read',
  'fleet:manage',
  'hospital:read',
  'hospital:manage',
  'user:manage',
  'role:approve',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  patient: [
    'profile:read:self',
    'profile:write:self',
    'appointment:create',
    'appointment:read:self',
    'record:read:self',
    'incident:create',
    'incident:read:self',
    'hospital:read',
  ],
  doctor: [
    'profile:read:self',
    'profile:write:self',
    'appointment:read:assigned',
    'appointment:manage',
    'record:read:assigned',
    'record:write',
    'prescription:write',
    'incident:read:assigned',
    'hospital:read',
  ],
  paramedic: [
    'profile:read:self',
    'profile:write:self',
    'incident:read:assigned',
    'incident:update_status',
    'location:publish',
    'record:write',
    'hospital:read',
    'fleet:read',
  ],
  dispatcher: [
    'profile:read:self',
    'incident:create',
    'incident:read:all',
    'incident:dispatch',
    'incident:update_status',
    'fleet:read',
    'hospital:read',
  ],
  hospital_admin: [
    'profile:read:self',
    'hospital:read',
    'hospital:manage',
    'incident:read:assigned',
    'fleet:read',
  ],
  admin: [...PERMISSIONS],
};

export function isRole(r: string): r is Role {
  return (ROLES as readonly string[]).includes(r);
}

export function permissionsFor(roles: readonly string[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const r of roles) {
    if (isRole(r)) for (const p of ROLE_PERMISSIONS[r]) set.add(p);
  }
  return set;
}

export function hasPermission(roles: readonly string[], permission: Permission): boolean {
  return permissionsFor(roles).has(permission);
}

/** Primary role used for UI routing — highest privilege wins. */
const ROLE_PRIORITY: Role[] = ['admin', 'dispatcher', 'hospital_admin', 'doctor', 'paramedic', 'patient'];
export function primaryRole(roles: readonly string[]): Role {
  return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? 'patient';
}

export const ROLE_LABELS: Record<Role, string> = {
  patient: 'Patient',
  doctor: 'Doctor',
  paramedic: 'Paramedic',
  dispatcher: 'Dispatcher',
  hospital_admin: 'Hospital Admin',
  admin: 'Administrator',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  patient: 'Book appointments, view your records and raise an SOS.',
  doctor: 'Manage your schedule, write clinical notes and prescriptions.',
  paramedic: 'Ambulance crew: publish GPS and update incidents.',
  dispatcher: 'Monitor the fleet and assign ambulances to incidents.',
  hospital_admin: 'Manage ER capacity and incoming patients for a hospital.',
  admin: 'Full platform administration, including user roles.',
};

/**
 * Role hierarchy. A higher rank means more authority. Approving or removing a role
 * requires `role:approve` and a rank strictly above that role (admins may manage admins).
 */
export const ROLE_RANK: Record<Role, number> = {
  patient: 10,
  paramedic: 30,
  doctor: 40,
  dispatcher: 50,
  hospital_admin: 60,
  admin: 100,
};

/** Roles anyone can hold without approval. */
export const SELF_SERVICE_ROLES: readonly Role[] = ['patient'];

export function highestRank(roles: readonly string[]): number {
  return Math.max(0, ...roles.filter(isRole).map((r) => ROLE_RANK[r]));
}

/** Whether a user holding `actorRoles` may grant or revoke `role` for someone else. */
export function canGrantRole(actorRoles: readonly string[], role: Role): boolean {
  if (!hasPermission(actorRoles, 'role:approve')) return false;
  if (actorRoles.includes('admin')) return true;
  return highestRank(actorRoles) > ROLE_RANK[role];
}

/** Whether `actorRoles` outranks the target user, so that their roles may be edited. */
export function canManageUser(actorRoles: readonly string[], targetRoles: readonly string[]): boolean {
  if (!hasPermission(actorRoles, 'role:approve')) return false;
  if (actorRoles.includes('admin')) return true;
  return highestRank(actorRoles) > highestRank(targetRoles);
}
