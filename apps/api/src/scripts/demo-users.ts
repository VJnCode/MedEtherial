import type { Role } from '@medetherial/shared';

/**
 * Demo identities. The `sub` values are pinned in infra/keycloak/realm-export.json
 * so MongoDB records line up with Keycloak accounts out of the box. Keep in sync.
 */
export interface DemoUser {
  sub: string;
  email: string;
  name: string;
  roles: Role[];
}

export const DEMO_USERS = {
  admin: { sub: 'a0000000-0000-4000-8000-000000000001', email: 'admin@medetherial.dev', name: 'Asha Kulkarni', roles: ['admin'] },
  dispatcher: { sub: 'a0000000-0000-4000-8000-000000000002', email: 'dispatch@medetherial.dev', name: 'Nikhil Joshi', roles: ['dispatcher'] },
  drRao: { sub: 'a0000000-0000-4000-8000-000000000003', email: 'dr.rao@medetherial.dev', name: 'Dr. Ananya Rao', roles: ['doctor'] },
  drMenon: { sub: 'a0000000-0000-4000-8000-000000000004', email: 'dr.menon@medetherial.dev', name: 'Dr. Vikram Menon', roles: ['doctor'] },
  drIyer: { sub: 'a0000000-0000-4000-8000-000000000005', email: 'dr.iyer@medetherial.dev', name: 'Dr. Kavya Iyer', roles: ['doctor'] },
  drShetty: { sub: 'a0000000-0000-4000-8000-000000000006', email: 'dr.shetty@medetherial.dev', name: 'Dr. Arjun Shetty', roles: ['doctor'] },
  paramedic: { sub: 'a0000000-0000-4000-8000-000000000007', email: 'paramedic@medetherial.dev', name: 'Ravi Kumar', roles: ['paramedic'] },
  hospitalAdmin: { sub: 'a0000000-0000-4000-8000-000000000008', email: 'hospital@medetherial.dev', name: 'Meera Nair', roles: ['hospital_admin'] },
  patient: { sub: 'a0000000-0000-4000-8000-000000000009', email: 'patient@medetherial.dev', name: 'Priya Sharma', roles: ['patient'] },
  patient2: { sub: 'a0000000-0000-4000-8000-00000000000a', email: 'rahul@medetherial.dev', name: 'Rahul Verma', roles: ['patient'] },
} satisfies Record<string, DemoUser>;
