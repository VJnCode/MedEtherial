'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { IncidentTracker } from '@/components/app/incident-tracker';
import { Button } from '@/components/ui/button';
import { useRoles } from '@/lib/hooks';

export default function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can, primary } = useRoles();
  const back = can('incident:dispatch') ? '/app/dispatch' : primary === 'paramedic' ? '/app/paramedic' : can('incident:read:all') || can('incident:read:assigned') ? '/app/incidents' : '/app';
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href={back}>
          <ArrowLeft /> Back
        </Link>
      </Button>
      <IncidentTracker incidentId={id} crewMode={primary === 'paramedic'} />
    </div>
  );
}
