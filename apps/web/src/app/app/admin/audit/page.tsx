'use client';

import { format } from 'date-fns';
import { ScrollText } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorNote, ListSkeleton, PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlay';
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { useApiQuery, type Page } from '@/lib/api';
import type { AuditEntry } from '@/lib/types';

const RESOURCE_TYPES = ['Patient', 'Appointment', 'Prescription', 'Encounter', 'Incident', 'Hospital', 'Ambulance', 'User'];

export default function AuditPage() {
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), limit: '50' });
  if (type !== 'all') params.set('resourceType', type);
  const res = useApiQuery<Page<AuditEntry>>(['audit', type, page], `/admin/audit?${params}`);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description="Append-only record of every access to health data and every administrative change." />
      <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
        <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All resources</SelectItem>
          {RESOURCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
      <ErrorNote error={res.error} />
      <Card className="py-0">
        <CardContent className="px-0">
          {res.isLoading ? (
            <div className="p-4"><ListSkeleton rows={8} /></div>
          ) : !res.data?.items.length ? (
            <div className="p-4"><EmptyState icon={ScrollText} title="No audit entries" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Request</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {res.data.items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{format(new Date(e.at), 'd MMM HH:mm:ss')}</TableCell>
                    <TableCell>
                      <p className="text-sm">{e.actorName ?? 'system'}</p>
                      <p className="text-muted-foreground text-xs">{e.actorRoles.join(', ')}</p>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="font-mono">{e.action}</Badge></TableCell>
                    <TableCell className="text-sm">
                      {e.resourceType} <span className="text-muted-foreground font-mono text-xs">{e.resourceId?.slice(-8)}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{e.ip ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{e.requestId?.slice(0, 8) ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {res.data && res.data.pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">Page {res.data.page} of {res.data.pages}</span>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page >= res.data.pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
