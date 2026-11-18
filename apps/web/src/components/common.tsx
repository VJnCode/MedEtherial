import {
  INCIDENT_STATUS_LABELS,
  type AmbulanceStatus,
  type AppointmentStatus,
  type IncidentStatus,
  type Severity,
} from '@medetherial/shared';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, Skeleton } from '@/components/ui/primitives';
import { cn, humanize } from '@/lib/utils';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' | 'outline' | 'muted';

const SEVERITY: Record<Severity, BadgeVariant> = { critical: 'destructive', high: 'warning', moderate: 'info', low: 'muted' };
const INCIDENT: Record<IncidentStatus, BadgeVariant> = {
  requested: 'destructive',
  assigned: 'warning',
  en_route: 'info',
  on_scene: 'info',
  transporting: 'default',
  at_hospital: 'success',
  closed: 'muted',
  cancelled: 'muted',
};
const APPOINTMENT: Record<AppointmentStatus, BadgeVariant> = {
  requested: 'warning',
  confirmed: 'info',
  completed: 'success',
  cancelled: 'muted',
  no_show: 'destructive',
};
const AMBULANCE: Record<AmbulanceStatus, BadgeVariant> = {
  available: 'success',
  dispatched: 'warning',
  busy: 'info',
  offline: 'muted',
  maintenance: 'muted',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge variant={SEVERITY[severity]} className="uppercase tracking-wide">
      {severity === 'critical' && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {severity}
    </Badge>
  );
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return <Badge variant={INCIDENT[status]}>{INCIDENT_STATUS_LABELS[status]}</Badge>;
}

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge variant={APPOINTMENT[status]}>{humanize(status)}</Badge>;
}

export function AmbulanceStatusBadge({ status }: { status: AmbulanceStatus }) {
  return <Badge variant={AMBULANCE[status]}>{humanize(status)}</Badge>;
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        {eyebrow && <p className="text-primary text-xs font-semibold tracking-widest uppercase">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="text-muted-foreground max-w-2xl text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'primary',
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: 'primary' | 'destructive' | 'success' | 'warning' | 'info';
  loading?: boolean;
}) {
  const tones = {
    primary: 'bg-primary/10 text-primary',
    destructive: 'bg-destructive/10 text-destructive',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/15 text-[oklch(0.55_0.12_70)] dark:text-warning',
    info: 'bg-info/10 text-info',
  };
  return (
    <Card className="gap-0 py-4">
      <CardContent className="flex items-start justify-between gap-3 px-4">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          {loading ? <Skeleton className="h-7 w-16" /> : <p className="font-mono text-2xl font-semibold tabular-nums">{value}</p>}
          {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
        </div>
        <div className={cn('rounded-lg p-2', tones[tone])}>
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <div className="bg-muted text-muted-foreground rounded-full p-3">
        <Icon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="text-muted-foreground max-w-sm text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function ErrorNote({ error }: { error: Error | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
      {error.message}
    </div>
  );
}
