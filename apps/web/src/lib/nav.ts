import { hasPermission, type Permission } from '@medetherial/shared';
import {
  Activity,
  Ambulance,
  CalendarClock,
  ClipboardList,
  FileHeart,
  Hospital,
  LayoutDashboard,
  type LucideIcon,
  MapPinned,
  ScrollText,
  Siren,
  Stethoscope,
  UserCog,
  Users,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Any one grants access; omit for everyone signed in. */
  permissions?: Permission[];
  /** Hide for callers holding one of these permissions (keeps menus focused). */
  hideIf?: Permission[];
  group: 'Overview' | 'Care' | 'Emergency' | 'Administration';
}

export const NAV: NavItem[] = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { href: '/app/emergency', label: 'Emergency SOS', icon: Siren, permissions: ['incident:read:self'], group: 'Emergency' },
  { href: '/app/doctors', label: 'Find a doctor', icon: Stethoscope, permissions: ['appointment:create'], group: 'Care' },
  { href: '/app/appointments', label: 'Appointments', icon: CalendarClock, permissions: ['appointment:read:self', 'appointment:read:assigned'], group: 'Care' },
  { href: '/app/records', label: 'Health records', icon: FileHeart, permissions: ['record:read:self'], hideIf: ['record:read:assigned'], group: 'Care' },
  { href: '/app/patients', label: 'My patients', icon: Users, permissions: ['record:read:assigned'], hideIf: ['user:manage'], group: 'Care' },
  { href: '/app/paramedic', label: 'Crew console', icon: Activity, permissions: ['location:publish'], hideIf: ['user:manage'], group: 'Emergency' },
  { href: '/app/dispatch', label: 'Dispatch centre', icon: MapPinned, permissions: ['incident:dispatch'], group: 'Emergency' },
  { href: '/app/incidents', label: 'Incidents', icon: ClipboardList, permissions: ['incident:read:all', 'incident:read:assigned'], hideIf: ['location:publish'], group: 'Emergency' },
  { href: '/app/fleet', label: 'Fleet', icon: Ambulance, permissions: ['fleet:read'], hideIf: ['location:publish'], group: 'Emergency' },
  { href: '/app/hospitals', label: 'Hospitals', icon: Hospital, permissions: ['hospital:manage', 'incident:dispatch'], group: 'Administration' },
  { href: '/app/admin/users', label: 'Users & roles', icon: UserCog, permissions: ['user:manage'], group: 'Administration' },
  { href: '/app/admin/audit', label: 'Audit log', icon: ScrollText, permissions: ['audit:read'], group: 'Administration' },
];

export function canSee(item: Pick<NavItem, 'permissions' | 'hideIf'>, roles: readonly string[]) {
  if (item.hideIf?.some((p) => hasPermission(roles, p)) && !roles.includes('admin')) return false;
  if (!item.permissions?.length) return true;
  return item.permissions.some((p) => hasPermission(roles, p));
}

export function navFor(roles: readonly string[]) {
  return NAV.filter((i) => canSee(i, roles));
}

/** Route-level guard used by middleware: longest matching prefix wins. */
export function requiredPermissionsFor(pathname: string): Permission[] | undefined {
  const extra: { prefix: string; permissions: Permission[] }[] = [
    { prefix: '/app/incidents', permissions: ['incident:read:self', 'incident:read:assigned', 'incident:read:all'] },
  ];
  // Explicit route rules override nav-derived ones for the same prefix
  // (e.g. patients may open /app/incidents/:id for their own emergency).
  const rules = new Map<string, Permission[] | undefined>(NAV.map((n) => [n.href, n.permissions]));
  for (const e of extra) rules.set(e.prefix, e.permissions);
  const candidates = [...rules.entries()]
    .map(([prefix, permissions]) => ({ prefix, permissions }))
    .filter((c) => c.prefix !== '/app' && (pathname === c.prefix || pathname.startsWith(`${c.prefix}/`)))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  return candidates[0]?.permissions;
}
