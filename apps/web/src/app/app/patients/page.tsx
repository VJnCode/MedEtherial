'use client';

import { ChevronRight, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { EmptyState, ErrorNote, ListSkeleton, PageHeader } from '@/components/common';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, Badge, Input } from '@/components/ui/primitives';
import { useApiQuery, type Page } from '@/lib/api';
import type { Patient } from '@/lib/types';
import { initials } from '@/lib/utils';

export default function PatientsPage() {
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const res = useApiQuery<Page<Patient>>(['patients', dq], `/patients?limit=50${dq ? `&q=${encodeURIComponent(dq)}` : ''}`);
  return (
    <div className="space-y-6">
      <PageHeader title="My patients" description="Patients with an appointment with you or an emergency routed to your hospital." />
      <div className="relative max-w-md">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or MRN" className="pl-9" aria-label="Search patients" />
      </div>
      <ErrorNote error={res.error} />
      {res.isLoading ? (
        <ListSkeleton />
      ) : !res.data?.items.length ? (
        <EmptyState icon={Users} title="No patients yet" description="Patients appear here once they book with you." />
      ) : (
        <Card className="py-0">
          <CardContent className="divide-y px-0">
            {res.data.items.map((p) => (
              <Link key={p.id} href={`/app/patients/${p.id}`} className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3">
                <Avatar className="size-9">
                  <AvatarFallback>{initials(p.user?.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.user?.name}</p>
                  <p className="text-muted-foreground font-mono text-xs">{p.mrn}</p>
                </div>
                <div className="hidden flex-wrap gap-1 sm:flex">
                  {p.conditions.slice(0, 2).map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}
                  {p.allergies.length > 0 && <Badge variant="destructive">{p.allergies.length} allerg{p.allergies.length > 1 ? 'ies' : 'y'}</Badge>}
                </div>
                <ChevronRight className="text-muted-foreground size-4" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
