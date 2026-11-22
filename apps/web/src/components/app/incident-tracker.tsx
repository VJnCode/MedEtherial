'use client';

import { INCIDENT_STATUS_LABELS, canTransition, type IncidentStatus, type LatLng } from '@medetherial/shared';
import { format, formatDistanceToNow } from 'date-fns';
import { Ambulance, Building2, Check, Clock, HeartPulse, MapPin, Phone, Route, ShieldAlert, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { ErrorNote, IncidentStatusBadge, SeverityBadge } from '@/components/common';
import { LiveMap, type MapMarker } from '@/components/map';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/overlay';
import { Badge, Input, Label, Skeleton } from '@/components/ui/primitives';
import { useApiMutation, useApiQuery, useInvalidate } from '@/lib/api';
import { useRoles } from '@/lib/hooks';
import { useSocketEvent, useWatchIncident } from '@/lib/socket';
import type { Incident } from '@/lib/types';
import { cn, formatDistance, formatEta } from '@/lib/utils';

const FLOW: IncidentStatus[] = ['requested', 'assigned', 'en_route', 'on_scene', 'transporting', 'at_hospital', 'closed'];
const NEXT_ACTION: Partial<Record<IncidentStatus, { to: IncidentStatus; label: string }>> = {
  assigned: { to: 'en_route', label: 'Start driving to patient' },
  en_route: { to: 'on_scene', label: 'Arrived on scene' },
  on_scene: { to: 'transporting', label: 'Patient loaded — transport' },
  transporting: { to: 'at_hospital', label: 'Arrived at hospital' },
  at_hospital: { to: 'closed', label: 'Handover complete — close' },
};

function StatusStepper({ incident }: { incident: Incident }) {
  const cancelled = incident.status === 'cancelled';
  const currentIdx = FLOW.indexOf(incident.status);
  const at = (s: IncidentStatus) => incident.timeline.find((t) => t.status === s)?.at;
  return (
    <ol className="space-y-0">
      {FLOW.map((s, i) => {
        const done = !cancelled && i <= currentIdx;
        const current = !cancelled && i === currentIdx;
        const time = at(s);
        return (
          <li key={s} className="relative flex gap-3 pb-5 last:pb-0">
            {i < FLOW.length - 1 && <span className={cn('absolute top-6 left-[11px] h-[calc(100%-1rem)] w-0.5', done && i < currentIdx ? 'bg-primary' : 'bg-border')} />}
            <span
              className={cn(
                'relative z-10 grid size-6 shrink-0 place-items-center rounded-full border-2 text-[10px]',
                done ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background',
                current && 'ring-primary/25 ring-4',
              )}
            >
              {done && <Check className="size-3" />}
            </span>
            <div className="-mt-0.5">
              <p className={cn('text-sm', done ? 'font-medium' : 'text-muted-foreground')}>{INCIDENT_STATUS_LABELS[s]}</p>
              {time && <p className="text-muted-foreground font-mono text-xs">{format(new Date(time), 'HH:mm:ss')}</p>}
            </div>
          </li>
        );
      })}
      {cancelled && (
        <li className="text-destructive flex items-center gap-2 pt-2 text-sm font-medium">
          <X className="size-4" /> Cancelled
        </li>
      )}
    </ol>
  );
}

function VitalsDialog({ incidentId }: { incidentId: string }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ heartRate: '', systolic: '', diastolic: '', spo2: '', respiratoryRate: '', temperature: '', gcs: '' });
  const save = useApiMutation<Record<string, number>>((body) => ({ path: `/incidents/${incidentId}/vitals`, body }), {
    invalidate: [['incident', incidentId]],
    success: 'Vitals recorded and shared with the hospital',
    onSuccess: () => setOpen(false),
  });
  const fields: [keyof typeof v, string, string][] = [
    ['heartRate', 'Heart rate', 'bpm'],
    ['systolic', 'Systolic', 'mmHg'],
    ['diastolic', 'Diastolic', 'mmHg'],
    ['spo2', 'SpO₂', '%'],
    ['respiratoryRate', 'Resp. rate', '/min'],
    ['temperature', 'Temp', '°C'],
    ['gcs', 'GCS', '3–15'],
  ];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <HeartPulse /> Record vitals
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record vitals</DialogTitle>
          <DialogDescription>Vitals are shared with the receiving hospital. Severity is escalated automatically when needed.</DialogDescription>
        </DialogHeader>
        <form
          className="grid grid-cols-2 gap-4 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            const body = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '').map(([k, x]) => [k, Number(x)]));
            save.mutate(body);
          }}
        >
          {fields.map(([k, label, unit]) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={k}>
                {label} <span className="text-muted-foreground text-xs font-normal">{unit}</span>
              </Label>
              <Input id={k} inputMode="decimal" type="number" step="any" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
            </div>
          ))}
          <DialogFooter className="col-span-full">
            <Button type="submit" disabled={save.isPending}>
              Save vitals
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function IncidentTracker({ incidentId, crewMode = false }: { incidentId: string; crewMode?: boolean }) {
  const invalidate = useInvalidate();
  const { can, is } = useRoles();
  const q = useApiQuery<Incident>(['incident', incidentId], `/incidents/${incidentId}`);
  const [live, setLive] = useState<{ pos?: LatLng; eta?: number; heading?: number }>({});
  useWatchIncident(incidentId);

  useSocketEvent('ambulance:location', (e) => {
    if (e.incidentId === incidentId) setLive({ pos: e.location, eta: e.etaSeconds, heading: e.heading });
  });
  useSocketEvent('incident:update', (e) => {
    if (e.incidentId === incidentId) invalidate(['incident', incidentId], ['incidents']);
  });

  const transition = useApiMutation<IncidentStatus>((status) => ({ path: `/incidents/${incidentId}/status`, method: 'PATCH', body: { status } }), {
    invalidate: [['incident', incidentId], ['incidents']],
    success: 'Status updated',
  });

  const incident = q.data;
  const ambulancePos = live.pos ?? incident?.ambulancePosition;
  const eta = live.eta ?? incident?.etaSeconds;

  const markers = useMemo<MapMarker[]>(() => {
    if (!incident) return [];
    const m: MapMarker[] = [
      { id: 'pickup', kind: 'incident', position: incident.position, tone: incident.severity, label: 'Patient location', sublabel: incident.address },
    ];
    if (incident.hospitalPosition && incident.hospital) {
      m.push({ id: 'hospital', kind: 'hospital', position: incident.hospitalPosition, label: incident.hospital.name, sublabel: incident.hospital.address });
    }
    if (ambulancePos && incident.ambulance && !['closed', 'cancelled'].includes(incident.status)) {
      m.push({ id: 'amb', kind: 'ambulance', position: ambulancePos, tone: 'busy', live: true, heading: live.heading, label: incident.ambulance.callsign, sublabel: `${incident.ambulance.type} · ${incident.ambulance.plate}` });
    }
    return m;
  }, [incident, ambulancePos, live.heading]);

  if (q.isLoading) return <Skeleton className="h-[70vh]" />;
  if (q.error || !incident) return <ErrorNote error={q.error ?? new Error('Incident not found')} />;

  const active = !['closed', 'cancelled'].includes(incident.status);
  const next = NEXT_ACTION[incident.status];
  const canDrive = crewMode || can('incident:dispatch');
  const canCancel = (is('patient') || can('incident:dispatch')) && canTransition(incident.status, 'cancelled');
  const latestVitals = incident.vitals.at(-1)?.vitals;
  const target = incident.status === 'transporting' ? 'hospital' : 'patient';

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="relative h-[52vh] min-h-80 overflow-hidden rounded-2xl border lg:h-[calc(100dvh-14rem)]">
          <LiveMap
            center={incident.position}
            zoom={14}
            markers={markers}
            routes={incident.route && active ? [{ id: 'route', positions: incident.route }] : []}
            fitTo={markers.map((m) => m.position)}
          />
          {active && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-background/90 absolute top-3 left-3 z-[400] rounded-xl border px-4 py-3 shadow-lg backdrop-blur"
            >
              <p className="text-muted-foreground text-xs">{incident.ambulance ? `ETA to ${target}` : 'Status'}</p>
              <p className="font-mono text-2xl font-semibold" data-testid="eta">
                {incident.ambulance ? formatEta(eta) : 'Dispatching…'}
              </p>
            </motion.div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <Card className="gap-4">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold">{incident.reference}</span>
              <SeverityBadge severity={incident.severity} />
            </div>
            <CardTitle className="pt-1">{INCIDENT_STATUS_LABELS[incident.status]}</CardTitle>
            <CardDescription>Raised {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {canDrive && next && active && (
              <Button className="w-full" size="lg" disabled={transition.isPending} onClick={() => transition.mutate(next.to)}>
                {next.label}
              </Button>
            )}
            {crewMode && active && <VitalsDialog incidentId={incident.id} />}
            {canCancel && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive hover:text-destructive w-full">
                    Cancel request
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel this emergency request?</DialogTitle>
                    <DialogDescription>The ambulance will be released for other patients. Only cancel if help is no longer needed.</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="destructive" onClick={() => transition.mutate('cancelled')} disabled={transition.isPending}>
                      Yes, cancel request
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        <Card className="gap-4">
          <CardContent className="space-y-4 text-sm">
            <div className="flex gap-3">
              <Ambulance className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              {incident.ambulance ? (
                <div>
                  <p className="font-medium">
                    {incident.ambulance.callsign} <Badge variant="secondary">{incident.ambulance.type}</Badge>
                  </p>
                  <p className="text-muted-foreground">{incident.ambulance.plate}</p>
                  {incident.ambulance.crew.map((c) => (
                    <p key={c.id} className="text-muted-foreground flex items-center gap-1.5">
                      {c.name}
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="text-primary inline-flex items-center gap-1">
                          <Phone className="size-3" /> Call
                        </a>
                      )}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Awaiting an available unit — you are in the priority queue.</p>
              )}
            </div>
            <div className="flex gap-3">
              <Building2 className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              {incident.hospital ? (
                <div>
                  <p className="font-medium">{incident.hospital.name}</p>
                  <p className="text-muted-foreground">{incident.hospital.address}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">Destination hospital pending</p>
              )}
            </div>
            <div className="flex gap-3">
              <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">{incident.symptoms.join(', ')}</p>
                {incident.description && <p className="text-muted-foreground">{incident.description}</p>}
              </div>
            </div>
            {incident.routeDistanceMeters !== undefined && active && (
              <div className="flex gap-3">
                <Route className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <p>Route {formatDistance(incident.routeDistanceMeters)}</p>
              </div>
            )}
            {incident.patient && (
              <div className="flex gap-3">
                <ShieldAlert className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">
                    {incident.patient.user?.name} · {incident.patient.mrn}
                  </p>
                  <p className="text-muted-foreground">
                    Blood {incident.patient.bloodGroup ?? '—'} · Allergies: {incident.patient.allergies.length ? incident.patient.allergies.join(', ') : 'none known'}
                  </p>
                </div>
              </div>
            )}
            {latestVitals && (
              <div className="bg-muted/50 grid grid-cols-3 gap-2 rounded-lg p-3 text-center">
                {[
                  ['HR', latestVitals.heartRate],
                  ['SpO₂', latestVitals.spo2],
                  ['BP', latestVitals.systolic ? `${latestVitals.systolic}/${latestVitals.diastolic ?? '–'}` : undefined],
                ].map(([k, val]) => (
                  <div key={k as string}>
                    <p className="text-muted-foreground text-[10px] uppercase">{k}</p>
                    <p className="font-mono font-semibold">{val ?? '—'}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4" /> Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusStepper incident={incident} />
          </CardContent>
        </Card>
        <div className="flex justify-center">
          <IncidentStatusBadge status={incident.status} />
        </div>
      </div>
    </div>
  );
}
