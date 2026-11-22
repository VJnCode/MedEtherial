'use client';

import { INCIDENT_STATUSES, SEVERITIES } from '@medetherial/shared';
import { format } from 'date-fns';
import { ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState, ErrorNote, IncidentStatusBadge, ListSkeleton, PageHeader, SeverityBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlay';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { useApiQuery, useInvalidate, type Page } from '@/lib/api';
import { useSocketEvent } from '@/lib/socket';
import type { Incident } from '@/lib/types';
import { humanize } from '@/lib/utils';

export default function IncidentsPage() {
  const invalidate = useInvalidate();
  const [status, setStatus] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), limit: '20' });
  if (status !== 'all') qs.set('status', status);
  if (severity !== 'all') qs.set('severity', severity);
  const q = useApiQuery<Page<Incident>>(['incidents', 'list', status, severity, page], `/incidents?${qs}`);
  useSocketEvent('incident:update', () => invalidate(['incidents']));
  useSocketEvent('incident:new', () => invalidate(['incidents']));

  return (
    <div className="space-y-6">
      <PageHeader title="Incidents" description="Emergency requests visible to you, newest first." />
      <div className="flex flex-wrap gap-3">
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {INCIDENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={(v) => { setSeverity(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <ErrorNote error={q.error} />
      <Card className="py-0">
        <CardContent className="px-0">
          {q.isLoading ? (
            <div className="p-4"><ListSkeleton /></div>
          ) : !q.data?.items.length ? (
            <div className="p-4"><EmptyState icon={ClipboardList} title="No incidents" description="Nothing matches these filters." /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Raised</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Symptoms</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Hospital</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell><Link href={`/app/incidents/${i.id}`} className="text-primary font-mono text-xs font-semibold hover:underline">{i.reference}</Link></TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(i.createdAt), 'd MMM HH:mm')}</TableCell>
                    <TableCell><SeverityBadge severity={i.severity} /></TableCell>
                    <TableCell><IncidentStatusBadge status={i.status} /></TableCell>
                    <TableCell className="max-w-56 truncate">{i.symptoms.join(', ')}</TableCell>
                    <TableCell className="font-mono text-xs">{i.ambulance?.callsign ?? '—'}</TableCell>
                    <TableCell className="max-w-48 truncate">{i.hospital?.name ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {q.data && q.data.pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">Page {q.data.page} of {q.data.pages}</span>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page >= q.data.pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
