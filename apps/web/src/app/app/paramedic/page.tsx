'use client';

import { Ambulance, Radio, Satellite, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { IncidentTracker } from '@/components/app/incident-tracker';
import { ManualDrive } from '@/components/app/manual-drive';
import { AmbulanceStatusBadge, EmptyState, PageHeader } from '@/components/common';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, Label, Skeleton, Switch } from '@/components/ui/primitives';
import { useApiQuery, useInvalidate, type Page } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import { useSocket, useSocketEvent } from '@/lib/socket';
import type { Ambulance as Unit, Incident } from '@/lib/types';

const SEND_EVERY_MS = 3000;

/** Streams the device's GPS over the authenticated socket while enabled. */
function useGpsBroadcast(ambulanceId: string | undefined, enabled: boolean) {
  const { socket, connected } = useSocket();
  const [fix, setFix] = useState<{ accuracy: number; at: number } | null>(null);
  const last = useRef(0);

  useEffect(() => {
    if (!enabled || !ambulanceId || !socket || !connected) return;
    if (!navigator.geolocation) {
      toast.error('This device does not support GPS');
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        const now = Date.now();
        setFix({ accuracy: Math.round(p.coords.accuracy), at: now });
        if (now - last.current < SEND_EVERY_MS) return;
        last.current = now;
        socket.emit(
          'location:publish',
          {
            ambulanceId,
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            accuracy: p.coords.accuracy,
            heading: p.coords.heading ?? undefined,
            speed: p.coords.speed ?? undefined,
          },
          (res) => {
            if (!res.ok) toast.error('Location rejected', { description: res.error });
          },
        );
      },
      (err) => toast.error('GPS error', { description: err.message }),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [enabled, ambulanceId, socket, connected]);

  return fix;
}

export default function ParamedicPage() {
  const me = useMe();
  const invalidate = useInvalidate();
  const ambulance = me.data?.ambulance;
  const [sharing, setSharing] = useState(false);
  const [driving, setDriving] = useState(false);
  // Real GPS and the manual test driver would fight over the position, so only one runs.
  const fix = useGpsBroadcast(ambulance?.id, sharing && !driving);
  const fleet = useApiQuery<Unit[]>(['ambulances'], '/ambulances', { enabled: Boolean(ambulance) });
  const ownUnit = (fleet.data ?? []).filter((u) => u.id === ambulance?.id);
  const active = useApiQuery<Page<Incident>>(['incidents', 'active'], '/incidents?active=true&limit=1', { enabled: Boolean(ambulance) });
  const incident = active.data?.items[0];

  useSocketEvent('incident:update', () => invalidate(['incidents'], ['me']));
  useSocketEvent('incident:new', () => invalidate(['incidents']));

  if (me.isLoading) return <Skeleton className="h-[70vh]" />;

  if (!ambulance) {
    return (
      <div className="space-y-6">
        <PageHeader title="Crew console" />
        <EmptyState icon={Ambulance} title="You are not assigned to an ambulance" description="Ask a fleet administrator to add you to a unit’s crew." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Crew console"
        title={ambulance.callsign}
        description={`${ambulance.type} unit · ${ambulance.plate}`}
        actions={<AmbulanceStatusBadge status={ambulance.status} />}
      />
      <Card className="py-4">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2.5 ${sharing ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
              <Satellite className="size-5" />
            </div>
            <div>
              <Label htmlFor="share" className="text-base">Share live location</Label>
              <p className="text-muted-foreground text-sm">
                {sharing
                  ? fix
                    ? `Broadcasting · accuracy ±${fix.accuracy} m`
                    : 'Waiting for GPS fix…'
                  : 'Your device takes over from the simulator while sharing.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {sharing && (
              <Badge variant="success" className="gap-1.5">
                <Radio className="size-3 animate-pulse" /> Live
              </Badge>
            )}
            <Switch id="share" checked={sharing && !driving} disabled={driving} onCheckedChange={setSharing} data-testid="share-location" />
          </div>
        </CardContent>
      </Card>

      {ownUnit.length > 0 && <ManualDrive units={ownUnit} fixedUnitId={ambulance.id} onActiveChange={setDriving} />}

      {active.isLoading ? (
        <Skeleton className="h-96" />
      ) : incident ? (
        <IncidentTracker incidentId={incident.id} crewMode />
      ) : (
        <EmptyState icon={ShieldCheck} title="No active assignment" description="You’ll be notified here the moment dispatch assigns an incident to your unit." />
      )}
    </div>
  );
}
