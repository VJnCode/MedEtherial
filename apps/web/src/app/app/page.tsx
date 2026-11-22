'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Suspense, useEffect } from 'react';
import { toast } from 'sonner';
import { DoctorDashboard, HospitalDashboard, OpsDashboard, PatientDashboard } from '@/components/app/dashboards';
import { Skeleton } from '@/components/ui/primitives';
import { useRoles } from '@/lib/hooks';

function DeniedNotice() {
  const params = useSearchParams();
  const router = useRouter();
  const denied = params.get('denied');
  useEffect(() => {
    if (denied) {
      toast.error('Access denied', { description: `Your role does not have access to ${denied}.` });
      router.replace('/app');
    }
  }, [denied, router]);
  return null;
}

export default function DashboardPage() {
  const { data, status } = useSession();
  const { primary } = useRoles();
  const router = useRouter();
  const name = data?.user?.name ?? 'there';

  useEffect(() => {
    if (status === 'authenticated' && primary === 'paramedic') router.replace('/app/paramedic');
  }, [primary, status, router]);

  if (status === 'loading') return <Skeleton className="h-96" />;

  return (
    <>
      <Suspense>
        <DeniedNotice />
      </Suspense>
      {primary === 'patient' && <PatientDashboard name={name} />}
      {primary === 'doctor' && <DoctorDashboard name={name} />}
      {primary === 'hospital_admin' && <HospitalDashboard name={name} />}
      {(primary === 'dispatcher' || primary === 'admin') && <OpsDashboard name={name} />}
      {primary === 'paramedic' && <Skeleton className="h-96" />}
    </>
  );
}
