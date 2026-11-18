'use client';

import { DEFAULT_CENTER, SYMPTOM_OPTIONS, triage, type LatLng } from '@medetherial/shared';
import { Crosshair, Loader2, MapPin, Siren } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, SeverityBadge } from '@/components/common';
import { LiveMap } from '@/components/map';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlay';
import { Input, Label, Skeleton, Textarea } from '@/components/ui/primitives';
import { useApiMutation, useApiQuery, type Page } from '@/lib/api';
import type { Incident } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function EmergencyPage() {
  const router = useRouter();
  const active = useApiQuery<Page<Incident>>(['incidents', 'active'], '/incidents?active=true&limit=1');
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [other, setOther] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [confirm, setConfirm] = useState(false);

  // Already have an emergency in progress → go straight to tracking.
  useEffect(() => {
    const i = active.data?.items[0];
    if (i) router.replace(`/app/incidents/${i.id}`);
  }, [active.data, router]);

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser. Tap the map to set your location.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocation({ lat: p.coords.latitude, lng: p.coords.longitude });
        setAccuracy(Math.round(p.coords.accuracy));
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        toast.error('Could not get your location', { description: `${err.message}. Tap the map to set it manually.` });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  };

  useEffect(locate, []);

  const allSymptoms = [...symptoms, ...(other.trim() ? [other.trim()] : [])];
  const predicted = allSymptoms.length ? triage(allSymptoms) : null;

  const sos = useApiMutation<void, Incident>(
    () => ({
      path: '/incidents',
      body: { location, symptoms: allSymptoms, description: description || undefined, address: address || undefined },
    }),
    {
      invalidate: [['incidents']],
      success: (i) => (i.ambulance ? `Ambulance ${i.ambulance.callsign} dispatched` : 'Request received — finding the nearest ambulance'),
      onSuccess: (i) => router.push(`/app/incidents/${i.id}`),
    },
  );

  if (active.isLoading) return <Skeleton className="h-[70vh]" />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Emergency" title="Request an ambulance" description="Share your location and what’s happening. The nearest suitable ambulance is dispatched automatically." />
      <div className="border-destructive/30 bg-destructive/5 rounded-xl border px-4 py-3 text-sm">
        <strong>Life-threatening emergency?</strong> Call your local emergency number <a href="tel:108" className="text-destructive font-semibold underline">108 / 112</a> as well.
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="text-primary size-4" />
              {location ? (
                <span className="font-mono text-xs">
                  {location.lat.toFixed(5)}, {location.lng.toFixed(5)} {accuracy !== null && <span className="text-muted-foreground">± {accuracy} m</span>}
                </span>
              ) : (
                <span className="text-muted-foreground">Tap the map or use GPS</span>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={locate} disabled={locating}>
              {locating ? <Loader2 className="animate-spin" /> : <Crosshair />} Use my location
            </Button>
          </div>
          <div className="h-[46vh] min-h-72">
            <LiveMap
              center={location ?? DEFAULT_CENTER}
              zoom={15}
              markers={location ? [{ id: 'me', kind: 'incident', tone: predicted ?? 'moderate', position: location, label: 'Pickup location' }] : []}
              fitTo={location ? [location] : undefined}
              onMapClick={(p) => {
                setLocation(p);
                setAccuracy(null);
              }}
            />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What’s happening?</CardTitle>
            <CardDescription>Select all that apply — this sets the dispatch priority.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Symptoms">
              {SYMPTOM_OPTIONS.map((s) => {
                const on = symptoms.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSymptoms(on ? symptoms.filter((x) => x !== s) : [...symptoms, s])}
                    className={cn(
                      'cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      on ? 'border-destructive bg-destructive text-white' : 'hover:bg-muted',
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="other">Other symptom</Label>
              <Input id="other" value={other} onChange={(e) => setOther(e.target.value)} placeholder="e.g. severe headache" maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Landmark / address (optional)</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Building, floor, nearby landmark" maxLength={300} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Details for the crew (optional)</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="Age, conscious?, medications…" />
            </div>
            {predicted && (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                Estimated priority: <SeverityBadge severity={predicted} />
              </p>
            )}
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button
                size="lg"
                variant="destructive"
                className="h-14 w-full text-base"
                disabled={!location || allSymptoms.length === 0 || sos.isPending}
                onClick={() => setConfirm(true)}
                data-testid="sos-button"
              >
                {sos.isPending ? <Loader2 className="animate-spin" /> : <Siren />} Send SOS
              </Button>
            </motion.div>
            {!location && <p className="text-muted-foreground text-center text-xs">Set your location to continue.</p>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send emergency request?</DialogTitle>
            <DialogDescription>An ambulance will be dispatched to your selected location right away.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Go back
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirm(false);
                sos.mutate();
              }}
            >
              <Siren /> Dispatch ambulance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
