'use client';

import { addDays, format } from 'date-fns';
import { Building2, CalendarPlus, Search, Star, Stethoscope } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useState } from 'react';
import { EmptyState, ErrorNote, PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlay';
import { Avatar, AvatarFallback, Badge, Input, Label, Skeleton, Textarea } from '@/components/ui/primitives';
import { useApiMutation, useApiQuery, type Page } from '@/lib/api';
import type { Doctor } from '@/lib/types';
import { cn, initials } from '@/lib/utils';

interface Slot {
  startsAt: string;
  endsAt: string;
  available: boolean;
}

function BookingDialog({ doctor, onClose }: { doctor: Doctor; onClose: () => void }) {
  const router = useRouter();
  const days = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));
  const [day, setDay] = useState(format(days[0]!, 'yyyy-MM-dd'));
  const [slot, setSlot] = useState<string>();
  const [reason, setReason] = useState('');
  const slots = useApiQuery<Slot[]>(['slots', doctor.id, day], `/doctors/${doctor.id}/slots?date=${day}`);
  const book = useApiMutation<void>(() => ({ path: '/appointments', body: { doctorId: doctor.id, startsAt: slot, reason } }), {
    invalidate: [['appointments'], ['slots', doctor.id]],
    success: 'Appointment requested — you’ll be notified when it’s confirmed',
    onSuccess: () => {
      onClose();
      router.push('/app/appointments');
    },
  });

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Book with {doctor.user.name}</DialogTitle>
        <DialogDescription>
          {doctor.specialty}
          {doctor.hospital ? ` · ${doctor.hospital.name}` : ''} · 30-minute consultation
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-5">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {days.map((d) => {
            const key = format(d, 'yyyy-MM-dd');
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setDay(key);
                  setSlot(undefined);
                }}
                className={cn(
                  'flex w-14 shrink-0 cursor-pointer flex-col items-center rounded-lg border py-2 text-xs transition-colors',
                  key === day ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                <span className="uppercase opacity-80">{format(d, 'EEE')}</span>
                <span className="text-base font-semibold">{format(d, 'd')}</span>
              </button>
            );
          })}
        </div>
        <div>
          <Label className="mb-2">Available times</Label>
          {slots.isLoading ? (
            <Skeleton className="h-24" />
          ) : !slots.data?.some((s) => s.available) ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">No free slots on this day.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {slots.data.map((s) => (
                <button
                  key={s.startsAt}
                  type="button"
                  disabled={!s.available}
                  onClick={() => setSlot(s.startsAt)}
                  className={cn(
                    'cursor-pointer rounded-md border py-2 font-mono text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35 disabled:line-through',
                    slot === s.startsAt ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                  )}
                >
                  {format(new Date(s.startsAt), 'HH:mm')}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason for visit</Label>
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Briefly describe your symptoms or reason" />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={!slot || reason.trim().length < 3 || book.isPending} onClick={() => book.mutate()}>
          <CalendarPlus /> {slot ? `Request ${format(new Date(slot), 'EEE d MMM, HH:mm')}` : 'Choose a time'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function DoctorsPage() {
  const [q, setQ] = useState('');
  const [specialty, setSpecialty] = useState('all');
  const [booking, setBooking] = useState<Doctor | null>(null);
  const dq = useDeferredValue(q);
  const params = new URLSearchParams({ limit: '30' });
  if (dq) params.set('q', dq);
  if (specialty !== 'all') params.set('specialty', specialty);
  const doctors = useApiQuery<Page<Doctor>>(['doctors', dq, specialty], `/doctors?${params}`);
  const specialties = useApiQuery<string[]>(['specialties'], '/doctors/specialties', { staleTime: 300_000 });

  return (
    <div className="space-y-6">
      <PageHeader title="Find a doctor" description="Search by name or specialty and book an available slot." />
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search doctors or specialties" className="pl-9" aria-label="Search doctors" />
        </div>
        <Select value={specialty} onValueChange={setSpecialty}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All specialties</SelectItem>
            {specialties.data?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <ErrorNote error={doctors.error} />
      {doctors.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : !doctors.data?.items.length ? (
        <EmptyState icon={Stethoscope} title="No doctors found" description="Try a different search or specialty." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {doctors.data.items.map((d) => (
            <Card key={d.id} className="gap-4">
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Avatar className="size-12">
                    <AvatarFallback className="text-sm">{initials(d.user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{d.user.name}</p>
                    <p className="text-primary text-sm">{d.specialty}</p>
                    {d.hospital && (
                      <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                        <Building2 className="size-3" /> {d.hospital.name}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Star className="size-3 fill-amber-400 text-amber-400" /> {d.rating.toFixed(1)}
                  </Badge>
                </div>
                {d.bio && <p className="text-muted-foreground line-clamp-2 text-sm">{d.bio}</p>}
                <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span>{d.yearsExperience} yrs experience</span>
                  <span>₹{d.consultationFee} consultation</span>
                  <span>{d.languages.join(', ')}</span>
                </div>
                <Button className="w-full" disabled={!d.acceptingPatients} onClick={() => setBooking(d)}>
                  <CalendarPlus /> {d.acceptingPatients ? 'Book appointment' : 'Not accepting patients'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={Boolean(booking)} onOpenChange={(o) => !o && setBooking(null)}>
        {booking && <BookingDialog doctor={booking} onClose={() => setBooking(null)} />}
      </Dialog>
    </div>
  );
}
