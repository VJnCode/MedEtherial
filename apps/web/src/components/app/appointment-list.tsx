'use client';

import type { AppointmentStatus } from '@medetherial/shared';
import { format, isToday } from 'date-fns';
import { CalendarX2, Check, CheckCheck, FileText, UserX, X } from 'lucide-react';
import Link from 'next/link';
import { AppointmentStatusBadge, EmptyState, ListSkeleton } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/primitives';
import { useApiMutation } from '@/lib/api';
import type { Appointment } from '@/lib/types';
import { initials } from '@/lib/utils';

export function useAppointmentAction() {
  return useApiMutation<{ id: string; status: AppointmentStatus }>(
    ({ id, status }) => ({ path: `/appointments/${id}/status`, method: 'PATCH', body: { status } }),
    { invalidate: [['appointments']], success: 'Appointment updated' },
  );
}

export function AppointmentList({
  items,
  loading,
  perspective,
  emptyText = 'No appointments to show.',
}: {
  items?: Appointment[];
  loading?: boolean;
  perspective: 'patient' | 'doctor' | 'admin';
  emptyText?: string;
}) {
  const action = useAppointmentAction();
  if (loading) return <ListSkeleton rows={3} />;
  if (!items?.length) return <EmptyState icon={CalendarX2} title="Nothing scheduled" description={emptyText} />;

  return (
    <ul className="divide-y rounded-xl border">
      {items.map((a) => {
        const start = new Date(a.startsAt);
        const counterpart = perspective === 'patient' ? a.doctor.user : a.patient.user;
        const subtitle = perspective === 'patient' ? `${a.doctor.specialty}${a.doctor.hospital ? ` · ${a.doctor.hospital.name}` : ''}` : `${a.patient.mrn} · ${a.reason}`;
        const future = start.getTime() > Date.now();
        const busy = action.isPending && action.variables?.id === a.id;
        return (
          <li key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="bg-muted flex w-16 shrink-0 flex-col items-center rounded-lg py-1.5 text-center">
              <span className="text-muted-foreground text-[10px] font-semibold uppercase">{isToday(start) ? 'Today' : format(start, 'EEE')}</span>
              <span className="text-lg leading-none font-semibold">{format(start, 'd')}</span>
              <span className="text-muted-foreground text-[10px]">{format(start, 'MMM')}</span>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar className="size-9">
                <AvatarFallback>{initials(counterpart?.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-medium">{counterpart?.name}</p>
                <p className="text-muted-foreground truncate text-sm">{subtitle}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="font-mono text-sm tabular-nums">{format(start, 'HH:mm')}</span>
              <AppointmentStatusBadge status={a.status} />
              {perspective === 'patient' && ['requested', 'confirmed'].includes(a.status) && future && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => action.mutate({ id: a.id, status: 'cancelled' })}>
                  <X /> Cancel
                </Button>
              )}
              {perspective !== 'patient' && a.status === 'requested' && (
                <>
                  <Button size="sm" disabled={busy} onClick={() => action.mutate({ id: a.id, status: 'confirmed' })}>
                    <Check /> Confirm
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => action.mutate({ id: a.id, status: 'cancelled' })}>
                    Decline
                  </Button>
                </>
              )}
              {perspective !== 'patient' && a.status === 'confirmed' && !future && (
                <>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => action.mutate({ id: a.id, status: 'completed' })}>
                    <CheckCheck /> Complete
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => action.mutate({ id: a.id, status: 'no_show' })}>
                    <UserX /> No-show
                  </Button>
                </>
              )}
              {perspective === 'doctor' && (
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`/app/patients/${a.patient.id}`}>
                    <FileText /> Chart
                  </Link>
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
