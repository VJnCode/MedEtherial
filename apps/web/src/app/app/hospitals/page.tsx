'use client';

import { DEFAULT_CENTER } from '@medetherial/shared';
import { BedDouble, Hospital as HospitalIcon, Minus, Phone, Plus } from 'lucide-react';
import { EmptyState, ErrorNote, PageHeader } from '@/components/common';
import { LiveMap } from '@/components/map';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, Progress, Skeleton } from '@/components/ui/primitives';
import { useApiMutation, useApiQuery } from '@/lib/api';
import { useMe, useRoles } from '@/lib/hooks';
import type { Hospital } from '@/lib/types';

export default function HospitalsPage() {
  const { is } = useRoles();
  const me = useMe();
  const q = useApiQuery<Hospital[]>(['hospitals'], '/hospitals', { refetchInterval: 20_000 });
  const update = useApiMutation<{ id: string; beds: number }>(({ id, beds }) => ({ path: `/hospitals/${id}/capacity`, method: 'PATCH', body: { erBedsAvailable: beds } }), {
    invalidate: [['hospitals']],
    success: 'Capacity updated',
  });
  const canEdit = (h: Hospital) => is('admin') || (is('hospital_admin') && me.data?.user.hospital?.id === h.id);

  return (
    <div className="space-y-6">
      <PageHeader title="Hospitals" description="Network emergency departments and live ER bed availability used for routing." />
      <ErrorNote error={q.error} />
      <div className="h-72 overflow-hidden rounded-2xl border">
        <LiveMap
          center={DEFAULT_CENTER}
          zoom={12}
          markers={(q.data ?? []).map((h) => ({ id: h.id, kind: 'hospital' as const, position: h.position, label: h.name, sublabel: `${h.erBedsAvailable}/${h.erBedsTotal} ER beds` }))}
          fitTo={q.data?.map((h) => h.position)}
        />
      </div>
      {q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : !q.data?.length ? (
        <EmptyState icon={HospitalIcon} title="No hospitals registered" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.map((h) => {
            const pct = (h.erBedsAvailable / Math.max(1, h.erBedsTotal)) * 100;
            return (
              <Card key={h.id} className="gap-4">
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{h.name}</p>
                      <p className="text-muted-foreground text-sm">{h.address}</p>
                      <a href={`tel:${h.phone}`} className="text-primary mt-1 inline-flex items-center gap-1 text-xs">
                        <Phone className="size-3" /> {h.phone}
                      </a>
                    </div>
                    {h.traumaCenter && <Badge variant="info">Trauma centre</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {h.specialties.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5"><BedDouble className="size-4" /> ER beds available</span>
                      <span className="font-mono font-semibold">{h.erBedsAvailable}/{h.erBedsTotal}</span>
                    </div>
                    <Progress value={pct} indicatorClassName={pct < 15 ? 'bg-destructive' : pct < 40 ? 'bg-warning' : 'bg-success'} />
                  </div>
                  {canEdit(h) && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={update.isPending || h.erBedsAvailable <= 0} onClick={() => update.mutate({ id: h.id, beds: h.erBedsAvailable - 1 })}>
                        <Minus /> Occupy
                      </Button>
                      <Button size="sm" variant="outline" disabled={update.isPending || h.erBedsAvailable >= h.erBedsTotal} onClick={() => update.mutate({ id: h.id, beds: h.erBedsAvailable + 1 })}>
                        <Plus /> Free
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
