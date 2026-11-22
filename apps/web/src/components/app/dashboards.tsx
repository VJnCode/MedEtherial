'use client';

import { format } from 'date-fns';
import {
  Activity,
  Ambulance,
  ArrowRight,
  BedDouble,
  CalendarClock,
  CalendarPlus,
  ClipboardList,
  FileHeart,
  Pill,
  Siren,
  Timer,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { AppointmentList } from '@/components/app/appointment-list';
import { IncidentList } from '@/components/app/incident-list';
import { PageHeader, StatCard } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, Progress, Skeleton } from '@/components/ui/primitives';
import { useApiMutation, useApiQuery, useInvalidate, type Page } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import { useSocketEvent } from '@/lib/socket';
import type { Appointment, Hospital, Incident, Overview, Prescription } from '@/lib/types';
import { formatEta, humanize } from '@/lib/utils';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/* ======================= Patient ======================= */
export function PatientDashboard({ name }: { name: string }) {
  const appts = useApiQuery<Page<Appointment>>(['appointments', 'upcoming', 3], '/appointments?scope=upcoming&limit=3');
  const active = useApiQuery<Page<Incident>>(['incidents', 'active'], '/incidents?active=true&limit=1');
  const rx = useApiQuery<Prescription[]>(['prescriptions', 'mine'], '/prescriptions/mine');
  const current = rx.data?.filter((p) => !p.validUntil || new Date(p.validUntil) > new Date()).flatMap((p) => p.medications) ?? [];
  const activeIncident = active.data?.items[0];

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={format(new Date(), 'EEEE, d MMMM')} title={`${greeting()}, ${name.split(' ')[0]}`} description="Your care at a glance." />

      {activeIncident && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Link
            href={`/app/incidents/${activeIncident.id}`}
            className="border-destructive/40 bg-destructive/5 hover:bg-destructive/10 flex flex-col gap-3 rounded-2xl border p-5 transition-colors sm:flex-row sm:items-center"
          >
            <div className="bg-destructive grid size-12 shrink-0 place-items-center rounded-full text-white">
              <Siren className="size-6 animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Emergency in progress · {humanize(activeIncident.status)}</p>
              <p className="text-muted-foreground text-sm">
                {activeIncident.ambulance ? `${activeIncident.ambulance.callsign} · ETA ${formatEta(activeIncident.etaSeconds)}` : 'Finding the nearest ambulance…'}
              </p>
            </div>
            <span className="text-destructive flex items-center gap-1 text-sm font-medium">
              Track live <ArrowRight className="size-4" />
            </span>
          </Link>
        </motion.div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { href: '/app/emergency', icon: Siren, title: 'Emergency SOS', body: 'Request an ambulance to your location', tone: 'bg-destructive text-white' },
          { href: '/app/doctors', icon: CalendarPlus, title: 'Book a visit', body: 'Find a doctor and pick a slot', tone: 'bg-primary text-primary-foreground' },
          { href: '/app/records', icon: FileHeart, title: 'Health records', body: 'Visits, prescriptions, emergencies', tone: 'bg-info text-white' },
        ].map((a, i) => (
          <motion.div key={a.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link href={a.href} className="group bg-card flex h-full items-start gap-4 rounded-2xl border p-5 transition-shadow hover:shadow-md">
              <div className={`${a.tone} rounded-xl p-2.5`}>
                <a.icon className="size-5" />
              </div>
              <div>
                <p className="font-semibold">{a.title}</p>
                <p className="text-muted-foreground text-sm">{a.body}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming appointments</CardTitle>
            <CardDescription>Your next scheduled visits</CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/app/appointments">View all</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <AppointmentList items={appts.data?.items} loading={appts.isLoading} perspective="patient" emptyText="Book a visit with a doctor to see it here." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Current medications</CardTitle>
            <CardDescription>From your active prescriptions</CardDescription>
          </CardHeader>
          <CardContent>
            {rx.isLoading ? (
              <Skeleton className="h-32" />
            ) : current.length ? (
              <ul className="space-y-3">
                {current.map((m, i) => (
                  <li key={`${m.name}-${i}`} className="flex items-start gap-3">
                    <div className="bg-primary/10 text-primary rounded-lg p-2">
                      <Pill className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {m.name} <span className="text-muted-foreground font-normal">{m.dosage}</span>
                      </p>
                      <p className="text-muted-foreground text-xs">{m.frequency}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">No active prescriptions.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ======================= Doctor ======================= */
export function DoctorDashboard({ name }: { name: string }) {
  const invalidate = useInvalidate();
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  const todays = useApiQuery<Page<Appointment>>(['appointments', 'today'], `/appointments?from=${start.toISOString()}&to=${end.toISOString()}&limit=50`);
  const pending = useApiQuery<Page<Appointment>>(['appointments', 'requested'], '/appointments?status=requested&scope=upcoming&limit=20');
  const incoming = useApiQuery<Page<Incident>>(['incidents', 'active'], '/incidents?active=true&limit=10');
  const patients = useApiQuery<Page<unknown>>(['patients', 'count'], '/patients?limit=1');

  useSocketEvent('hospital:alert', (e) => {
    toast.warning(`Incoming ${e.severity} patient · ${e.reference}`, { description: `${e.patientSummary} · ETA ${formatEta(e.etaSeconds)}`, duration: 15_000 });
    invalidate(['incidents']);
  });
  useSocketEvent('incident:update', () => invalidate(['incidents']));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={format(today, 'EEEE, d MMMM')} title={`${greeting()}, ${name}`} description="Your clinic day and incoming emergencies." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today’s visits" value={todays.data?.total ?? 0} icon={CalendarClock} loading={todays.isLoading} />
        <StatCard label="Pending requests" value={pending.data?.total ?? 0} icon={ClipboardList} tone="warning" loading={pending.isLoading} />
        <StatCard label="Patients under care" value={patients.data?.total ?? 0} icon={Users} tone="info" loading={patients.isLoading} />
        <StatCard label="Incoming emergencies" value={incoming.data?.total ?? 0} icon={Siren} tone="destructive" loading={incoming.isLoading} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Today’s schedule</CardTitle>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/app/appointments">All appointments</Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <AppointmentList items={todays.data?.items} loading={todays.isLoading} perspective="doctor" emptyText="No visits today." />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Awaiting confirmation</CardTitle>
              <CardDescription>New booking requests from patients</CardDescription>
            </CardHeader>
            <CardContent>
              <AppointmentList items={pending.data?.items} loading={pending.isLoading} perspective="doctor" emptyText="You’re all caught up." />
            </CardContent>
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Siren className="text-destructive size-4" /> Incoming to your hospital
            </CardTitle>
            <CardDescription>Live, with pre-arrival vitals</CardDescription>
          </CardHeader>
          <CardContent>
            <IncidentList items={incoming.data?.items} loading={incoming.isLoading} emptyText="No patients en route." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ======================= Operations (dispatcher / admin) ======================= */
export function OpsDashboard({ name }: { name: string }) {
  const invalidate = useInvalidate();
  const stats = useApiQuery<Overview>(['stats'], '/stats/overview', { refetchInterval: 30_000 });
  const active = useApiQuery<Page<Incident>>(['incidents', 'active'], '/incidents?active=true&limit=8');
  useSocketEvent('incident:new', (e) => {
    toast.error(`New ${e.severity} incident · ${e.reference}`);
    invalidate(['incidents'], ['stats']);
  });
  useSocketEvent('incident:update', () => invalidate(['incidents']));

  const s = stats.data;
  const fleetTotal = Object.values(s?.fleet ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  const activeCount = active.data?.total ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operations"
        title={`${greeting()}, ${name.split(' ')[0]}`}
        description="Live view of emergency operations across the network."
        actions={
          <Button asChild>
            <Link href="/app/dispatch">
              Open dispatch centre <ArrowRight />
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active incidents" value={activeCount} icon={Siren} tone="destructive" loading={active.isLoading} />
        <StatCard
          label="Units available"
          value={`${s?.fleet.available ?? 0}/${fleetTotal}`}
          icon={Ambulance}
          tone="success"
          loading={stats.isLoading}
          hint={`${s?.fleet.dispatched ?? 0} dispatched · ${s?.fleet.busy ?? 0} on scene`}
        />
        <StatCard
          label="Avg. response (7d)"
          value={s?.responseTime.avgSeconds ? formatEta(s.responseTime.avgSeconds) : '—'}
          hint={s?.responseTime.p90Seconds ? `p90 ${formatEta(s.responseTime.p90Seconds)}` : 'Call to on-scene'}
          icon={Timer}
          tone="info"
          loading={stats.isLoading}
        />
        <StatCard
          label="ER beds free"
          value={`${s?.erBeds.available ?? 0}/${s?.erBeds.total ?? 0}`}
          icon={BedDouble}
          tone="warning"
          loading={stats.isLoading}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Incident volume</CardTitle>
            <CardDescription>Last 7 days · total vs. critical</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {stats.isLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={s?.daily ?? []} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillCrit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => format(new Date(d), 'EEE')} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <ChartTooltip
                    contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--popover-foreground)' }}
                    labelFormatter={(d: string) => format(new Date(d), 'EEE d MMM')}
                  />
                  <Area type="monotone" dataKey="total" name="Total" stroke="var(--chart-1)" fill="url(#fillTotal)" strokeWidth={2} />
                  <Area type="monotone" dataKey="critical" name="Critical" stroke="var(--chart-2)" fill="url(#fillCrit)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active incidents</CardTitle>
            <CardAction>
              <Badge variant={activeCount ? 'destructive' : 'success'}>{activeCount ? `${activeCount} open` : 'All clear'}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <IncidentList items={active.data?.items} loading={active.isLoading} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Fleet status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-5">
          {(['available', 'dispatched', 'busy', 'offline', 'maintenance'] as const).map((k) => (
            <div key={k} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{humanize(k)}</span>
                <span className="font-mono font-medium">{s?.fleet[k] ?? 0}</span>
              </div>
              <Progress value={fleetTotal ? ((s?.fleet[k] ?? 0) / fleetTotal) * 100 : 0} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ======================= Hospital admin ======================= */
export function HospitalDashboard({ name }: { name: string }) {
  const me = useMe();
  const invalidate = useInvalidate();
  const hospitals = useApiQuery<Hospital[]>(['hospitals'], '/hospitals');
  const incoming = useApiQuery<Page<Incident>>(['incidents', 'active'], '/incidents?active=true&limit=10');
  const own = hospitals.data?.find((h) => h.id === me.data?.user.hospital?.id);
  const update = useApiMutation<number>((beds) => ({ path: `/hospitals/${own?.id}/capacity`, method: 'PATCH', body: { erBedsAvailable: beds } }), {
    invalidate: [['hospitals']],
    success: 'Capacity updated',
  });
  useSocketEvent('hospital:alert', (e) => {
    toast.warning(`Incoming ${e.severity} patient · ETA ${formatEta(e.etaSeconds)}`, { description: e.patientSummary, duration: 15_000 });
    invalidate(['incidents']);
  });

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={own?.name ?? 'Hospital'} title={`${greeting()}, ${name.split(' ')[0]}`} description="Keep emergency capacity accurate so ambulances are routed correctly." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BedDouble className="size-4" /> Emergency department capacity
            </CardTitle>
            <CardDescription>Used by the dispatch engine to choose destinations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!own ? (
              <Skeleton className="h-28" />
            ) : (
              <>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="font-mono text-5xl font-semibold">{own.erBedsAvailable}</p>
                    <p className="text-muted-foreground text-sm">of {own.erBedsTotal} beds available</p>
                  </div>
                  <Activity className="text-primary size-8" />
                </div>
                <Progress value={(own.erBedsAvailable / Math.max(1, own.erBedsTotal)) * 100} />
                <div className="flex gap-2">
                  <Button variant="outline" disabled={update.isPending || own.erBedsAvailable <= 0} onClick={() => update.mutate(own.erBedsAvailable - 1)}>
                    − Occupy bed
                  </Button>
                  <Button disabled={update.isPending || own.erBedsAvailable >= own.erBedsTotal} onClick={() => update.mutate(own.erBedsAvailable + 1)}>
                    + Free bed
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Incoming patients</CardTitle>
            <CardDescription>Ambulances routed to your emergency department</CardDescription>
          </CardHeader>
          <CardContent>
            <IncidentList items={incoming.data?.items} loading={incoming.isLoading} emptyText="No incoming patients right now." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
