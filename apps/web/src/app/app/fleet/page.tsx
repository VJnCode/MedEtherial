'use client';

import { AMBULANCE_STATUSES, type AmbulanceStatus } from '@medetherial/shared';
import { formatDistanceToNow } from 'date-fns';
import { Ambulance, Cpu, Smartphone } from 'lucide-react';
import { AmbulanceStatusBadge, EmptyState, ErrorNote, ListSkeleton, PageHeader } from '@/components/common';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlay';
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/primitives';
import { useApiMutation, useApiQuery } from '@/lib/api';
import { useRoles } from '@/lib/hooks';
import type { Ambulance as Unit } from '@/lib/types';
import { humanize } from '@/lib/utils';

export default function FleetPage() {
  const { can } = useRoles();
  const q = useApiQuery<Unit[]>(['ambulances'], '/ambulances', { refetchInterval: 10_000 });
  const update = useApiMutation<{ id: string; status: AmbulanceStatus }>(({ id, status }) => ({ path: `/ambulances/${id}`, method: 'PATCH', body: { status } }), {
    invalidate: [['ambulances']],
    success: 'Unit status updated',
  });
  const manage = can('fleet:manage');

  return (
    <div className="space-y-6">
      <PageHeader title="Fleet" description="Every ambulance with its live status, crew and GPS source." />
      <ErrorNote error={q.error} />
      <Card className="py-0">
        <CardContent className="px-0">
          {q.isLoading ? (
            <div className="p-4"><ListSkeleton /></div>
          ) : !q.data?.length ? (
            <div className="p-4"><EmptyState icon={Ambulance} title="No ambulances registered" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Crew</TableHead>
                  <TableHead>GPS source</TableHead>
                  <TableHead>Last fix</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.map((a) => {
                  const device = a.lastDevicePingAt && Date.now() - new Date(a.lastDevicePingAt).getTime() < 60_000;
                  const locked = a.status === 'dispatched' || a.status === 'busy';
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <p className="font-mono font-semibold">{a.callsign}</p>
                        <p className="text-muted-foreground text-xs">{a.plate}</p>
                      </TableCell>
                      <TableCell><Badge variant={a.type === 'ALS' ? 'info' : 'secondary'}>{a.type}</Badge></TableCell>
                      <TableCell>
                        {manage && !locked ? (
                          <Select value={a.status} onValueChange={(v) => update.mutate({ id: a.id, status: v as AmbulanceStatus })}>
                            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {AMBULANCE_STATUSES.filter((s) => s !== 'dispatched' && s !== 'busy').map((s) => (
                                <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <AmbulanceStatusBadge status={a.status} />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.crew.length ? a.crew.map((c) => c.name).join(', ') : '—'}</TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1.5 text-xs">
                            {device ? <Smartphone className="text-success size-3.5" /> : <Cpu className="text-muted-foreground size-3.5" />}
                            {device ? 'Crew device' : a.simulated ? 'Simulator' : 'Static'}
                          </TooltipTrigger>
                          <TooltipContent>{device ? 'Live GPS from the crew’s phone' : 'No device fix in the last 60s'}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{a.lastSeenAt ? formatDistanceToNow(new Date(a.lastSeenAt), { addSuffix: true }) : '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
