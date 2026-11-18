'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { EncounterTimeline, IncidentHistory, NoteDialog, PatientSummary, PrescriptionDialog, PrescriptionList } from '@/components/app/clinical';
import { ErrorNote, PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/api';
import { useRoles } from '@/lib/hooks';
import type { Encounter, Incident, Patient, Prescription } from '@/lib/types';

export default function PatientChartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useRoles();
  const patient = useApiQuery<Patient>(['patient', id], `/patients/${id}`);
  const records = useApiQuery<{ encounters: Encounter[]; prescriptions: Prescription[]; incidents: Incident[] }>(['records', id], `/patients/${id}/records`);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/app/patients">
          <ArrowLeft /> Patients
        </Link>
      </Button>
      <PageHeader
        eyebrow="Patient chart"
        title={patient.data?.user?.name ?? 'Loading…'}
        description="Access to this chart is recorded in the audit log."
        actions={
          <>
            {can('record:write') && <NoteDialog patientId={id} />}
            {can('prescription:write') && <PrescriptionDialog patientId={id} />}
          </>
        }
      />
      <ErrorNote error={patient.error ?? records.error} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div>{patient.data ? <PatientSummary patient={patient.data} /> : <Skeleton className="h-80" />}</div>
        <Tabs defaultValue="timeline">
          <TabsList>
            <TabsTrigger value="timeline">Clinical notes</TabsTrigger>
            <TabsTrigger value="rx">Prescriptions</TabsTrigger>
            <TabsTrigger value="emergencies">Emergencies</TabsTrigger>
          </TabsList>
          {records.isLoading || !records.data ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              <TabsContent value="timeline"><EncounterTimeline items={records.data.encounters} /></TabsContent>
              <TabsContent value="rx"><PrescriptionList items={records.data.prescriptions} /></TabsContent>
              <TabsContent value="emergencies"><IncidentHistory items={records.data.incidents} /></TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}
