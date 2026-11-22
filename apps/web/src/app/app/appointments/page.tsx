'use client';

import { CalendarPlus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AppointmentList } from '@/components/app/appointment-list';
import { ErrorNote, PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/primitives';
import { useApiQuery, type Page } from '@/lib/api';
import { useRoles } from '@/lib/hooks';
import type { Appointment } from '@/lib/types';

function Scoped({ scope, perspective }: { scope: 'upcoming' | 'past' | 'requested'; perspective: 'patient' | 'doctor' | 'admin' }) {
  const path = scope === 'requested' ? '/appointments?status=requested&scope=upcoming&limit=50' : `/appointments?scope=${scope}&limit=50`;
  const q = useApiQuery<Page<Appointment>>(['appointments', 'tab', scope], path);
  return (
    <div className="space-y-3">
      <ErrorNote error={q.error} />
      <AppointmentList items={q.data?.items} loading={q.isLoading} perspective={perspective} />
    </div>
  );
}

export default function AppointmentsPage() {
  const { is, can } = useRoles();
  const perspective = is('admin') ? 'admin' : is('doctor') ? 'doctor' : 'patient';
  const [tab, setTab] = useState(perspective === 'doctor' ? 'requested' : 'upcoming');
  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description={perspective === 'doctor' ? 'Confirm requests, complete visits and open patient charts.' : 'Your scheduled and past visits.'}
        actions={
          can('appointment:create') && (
            <Button asChild>
              <Link href="/app/doctors">
                <CalendarPlus /> Book appointment
              </Link>
            </Button>
          )
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {perspective !== 'patient' && <TabsTrigger value="requested">Requests</TabsTrigger>}
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>
        {perspective !== 'patient' && (
          <TabsContent value="requested">
            <Scoped scope="requested" perspective={perspective} />
          </TabsContent>
        )}
        <TabsContent value="upcoming">
          <Scoped scope="upcoming" perspective={perspective} />
        </TabsContent>
        <TabsContent value="past">
          <Scoped scope="past" perspective={perspective} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
