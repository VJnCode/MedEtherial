'use client';

import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { EncounterTimeline, IncidentHistory, PatientSummary, PrescriptionList } from '@/components/app/clinical';
import { ErrorNote, PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import type { Encounter, Incident, Prescription } from '@/lib/types';

export default function RecordsPage() {
  const me = useMe();
  const pid = me.data?.patient?.id;
  const records = useApiQuery<{ encounters: Encounter[]; prescriptions: Prescription[]; incidents: Incident[] }>(['records', pid], pid ? `/patients/${pid}/records` : null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Health records"
        description="Your visits, prescriptions and emergency history in one place."
        actions={
          <Button asChild variant="outline">
            <Link href="/app/profile">
              <Pencil /> Edit medical profile
            </Link>
          </Button>
        }
      />
      <ErrorNote error={me.error ?? records.error} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div>{me.data?.patient ? <PatientSummary patient={{ ...me.data.patient, user: me.data.user }} /> : <Skeleton className="h-80" />}</div>
        <Tabs defaultValue="visits">
          <TabsList>
            <TabsTrigger value="visits">Visits</TabsTrigger>
            <TabsTrigger value="rx">Prescriptions</TabsTrigger>
            <TabsTrigger value="emergencies">Emergencies</TabsTrigger>
          </TabsList>
          {records.isLoading || !records.data ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              <TabsContent value="visits"><EncounterTimeline items={records.data.encounters} /></TabsContent>
              <TabsContent value="rx"><PrescriptionList items={records.data.prescriptions} /></TabsContent>
              <TabsContent value="emergencies"><IncidentHistory items={records.data.incidents} /></TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}
