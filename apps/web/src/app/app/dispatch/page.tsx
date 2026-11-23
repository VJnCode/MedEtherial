'use client';

import { DEFAULT_CENTER, type AmbulanceLocationEvent } from '@medetherial/shared';
import { Ambulance as AmbIcon, ExternalLink, Shuffle } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { IncidentList } from '@/components/app/incident-list';
import { ManualDrive } from '@/components/app/manual-drive';
import { AmbulanceStatusBadge, PageHeader, SeverityBadge } from '@/components/common';
import { LiveMap, type MapMarker } from '@/components/map';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlay';
import { Badge, Label } from '@/components/ui/primitives';
import { useApiMutation, useApiQuery, useInvalidate, type Page } from '@/lib/api';
import { useRoles } from '@/lib/hooks';
import { useSocketEvent } from '@/lib/socket';
import type { Ambulance, Hospital, Incident } from '@/lib/types';
import { formatEta } from '@/lib/utils';

function AssignDialog({ incident, ambulances, hospitals }: { incident: Incident; ambulances: Ambulance[]; hospitals: Hospital[] }) {
  const [open, setOpen] = useState(false);
  const [ambulanceId, setAmbulanceId] = useState<string>();
  const [hospitalId, setHospitalId] = useState<string>();
  const assign = useApiMutation<void>(() => ({ path: `/incidents/${incident.id}/assign`, body: { ambulanceId, hospitalId } }), {
    invalidate: [['incidents'], ['ambulances'], ['incident', incident.id]],
    success: 'Assignment updated',
    onSuccess: () => setOpen(false),
  });
  const available = ambulances.filter((a) => a.status === 'available');
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Shuffle /> {incident.ambulance ? 'Reassign' : 'Assign'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign {incident.reference}</DialogTitle>
          <DialogDescription>Override the automatic choice of unit or destination hospital.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Ambulance</Label>
            <Select value={ambulanceId} onValueChange={setAmbulanceId}>
              <SelectTrigger>
                <SelectValue placeholder={available.length ? 'Choose an available unit' : 'No units available'} />
              </SelectTrigger>
              <SelectContent>
                {available.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.callsign} · {a.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Destination hospital</Label>
            <Select value={hospitalId} onValueChange={setHospitalId}>
              <SelectTrigger>
                <SelectValue placeholder={incident.hospital?.name ?? 'Choose a hospital'} />
              </SelectTrigger>
              <SelectContent>
                {hospitals.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name} · {h.erBedsAvailable} beds{h.traumaCenter ? ' · Trauma' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={(!ambulanceId && !hospitalId) || assign.isPending} onClick={() => assign.mutate()}>
            Confirm assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DispatchPage() {
  const invalidate = useInvalidate();
  const incidents = useApiQuery<Page<Incident>>(['incidents', 'active'], '/incidents?active=true&limit=50');
  const fleet = useApiQuery<Ambulance[]>(['ambulances'], '/ambulances');
  const hospitals = useApiQuery<Hospital[]>(['hospitals'], '/hospitals');
  const [livePos, setLivePos] = useState<Record<string, AmbulanceLocationEvent>>({});
  const [selected, setSelected] = useState<string>();
  // Only admins may publish positions for any unit (crews drive their own from the crew console).
  const canDrive = useRoles().is('admin');

  useSocketEvent('ambulance:location', (e) => setLivePos((prev) => ({ ...prev, [e.ambulanceId]: e })));
  useSocketEvent('incident:new', (e) => {
    toast.error(`New ${e.severity} incident · ${e.reference}`, { action: { label: 'View', onClick: () => setSelected(e.incidentId) } });
    invalidate(['incidents'], ['ambulances']);
  });
  useSocketEvent('incident:update', () => invalidate(['incidents'], ['ambulances']));

  const sel = incidents.data?.items.find((i) => i.id === selected);

  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [];
    for (const h of hospitals.data ?? []) {
      m.push({ id: `h-${h.id}`, kind: 'hospital', position: h.position, label: h.name, sublabel: `${h.erBedsAvailable}/${h.erBedsTotal} ER beds${h.traumaCenter ? ' · Trauma centre' : ''}` });
    }
    for (const i of incidents.data?.items ?? []) {
      m.push({ id: `i-${i.id}`, kind: 'incident', position: i.position, tone: i.severity, label: i.reference, sublabel: i.symptoms.join(', '), onClick: () => setSelected(i.id) });
    }
    for (const a of fleet.data ?? []) {
      const live = livePos[a.id];
      const status = live?.status ?? a.status;
      m.push({
        id: `a-${a.id}`,
        kind: 'ambulance',
        position: live?.location ?? a.position,
        heading: live?.heading,
        live: true,
        tone: status === 'available' ? 'available' : status === 'offline' || status === 'maintenance' ? 'offline' : 'busy',
        label: `${a.callsign} · ${a.type}`,
        sublabel: status.replace('_', ' '),
      });
    }
    return m;
  }, [hospitals.data, incidents.data, fleet.data, livePos]);

  const counts = (fleet.data ?? []).reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }), {});

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dispatch centre"
        title="Live operations"
        description="Fleet positions, active incidents and hospital capacity in real time."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">{counts.available ?? 0} available</Badge>
            <Badge variant="warning">{(counts.dispatched ?? 0) + (counts.busy ?? 0)} committed</Badge>
            <Badge variant="destructive">{incidents.data?.total ?? 0} incidents</Badge>
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="relative h-[60vh] min-h-96 overflow-hidden rounded-2xl border xl:h-[calc(100dvh-13rem)]">
          <LiveMap
            center={DEFAULT_CENTER}
            zoom={13}
            markers={markers}
            routes={sel?.route ? [{ id: 'sel', positions: sel.route }] : []}
            fitTo={sel ? [sel.position, ...(sel.ambulancePosition ? [sel.ambulancePosition] : [])] : undefined}
          />
          <div className="bg-background/90 absolute bottom-3 left-3 z-[400] flex flex-wrap gap-3 rounded-lg border px-3 py-2 text-xs shadow backdrop-blur">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-green-600" /> Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-amber-500" /> Committed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-red-600" /> Critical call
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-cyan-700" /> Hospital
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {sel && (
            <Card className="border-primary gap-3">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{sel.reference}</span>
                  <SeverityBadge severity={sel.severity} />
                </div>
                <CardTitle className="text-base">{sel.symptoms.join(', ')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  {sel.ambulance ? `${sel.ambulance.callsign} → ${sel.hospital?.name ?? 'hospital TBD'} · ETA ${formatEta(sel.etaSeconds)}` : 'Waiting for a unit'}
                </p>
                <div className="flex gap-2">
                  <AssignDialog incident={sel} ambulances={fleet.data ?? []} hospitals={hospitals.data ?? []} />
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/app/incidents/${sel.id}`}>
                      <ExternalLink /> Open
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="text-base">Incident queue</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[40vh] overflow-y-auto">
              <IncidentList items={incidents.data?.items} loading={incidents.isLoading} selectedId={selected} onSelect={(i) => setSelected(i.id)} />
            </CardContent>
          </Card>
          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AmbIcon className="size-4" /> Units
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-64 space-y-2 overflow-y-auto">
              {(fleet.data ?? []).map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span className="font-mono">
                    {a.callsign} <span className="text-muted-foreground">{a.type}</span>
                  </span>
                  <AmbulanceStatusBadge status={livePos[a.id]?.status ?? a.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      {canDrive && <ManualDrive units={fleet.data ?? []} />}
    </div>
  );
}
