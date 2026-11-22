'use client';

import { BLOOD_GROUPS, ROLE_LABELS } from '@medetherial/shared';
import { ExternalLink, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MyRolesCard } from '@/components/app/roles';
import { PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlay';
import { Badge, Input, Label, Skeleton, Switch } from '@/components/ui/primitives';
import { useApiMutation } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import type { Doctor, Patient } from '@/lib/types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const accountUrl = process.env.NEXT_PUBLIC_KEYCLOAK_ACCOUNT_URL;

function PatientProfileForm({ patient }: { patient: Patient }) {
  const [form, setForm] = useState({
    dateOfBirth: patient.dateOfBirth?.slice(0, 10) ?? '',
    gender: patient.gender ?? '',
    bloodGroup: patient.bloodGroup ?? '',
    phone: patient.phone ?? '',
    address: patient.address ?? '',
    allergies: patient.allergies.join(', '),
    conditions: patient.conditions.join(', '),
  });
  const [contacts, setContacts] = useState(patient.emergencyContacts);
  const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
  const save = useApiMutation<void>(
    () => ({
      path: '/me/patient',
      method: 'PATCH',
      body: {
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        bloodGroup: form.bloodGroup || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        allergies: list(form.allergies),
        conditions: list(form.conditions),
        emergencyContacts: contacts.filter((c) => c.name && c.phone),
      },
    }),
    { invalidate: [['me'], ['records']], success: 'Medical profile saved' },
  );
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Medical profile</CardTitle>
        <CardDescription>Shared with your treating clinicians and the ambulance crew during an emergency.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="dob">Date of birth</Label>
              <Input id="dob" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {['female', 'male', 'other', 'undisclosed'].map((g) => <SelectItem key={g} value={g}>{g[0]!.toUpperCase() + g.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Blood group</Label>
              <Select value={form.bloodGroup} onValueChange={(v) => setForm({ ...form, bloodGroup: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUPS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={set('phone')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={form.address} onChange={set('address')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="allergies">Allergies (comma-separated)</Label>
              <Input id="allergies" value={form.allergies} onChange={set('allergies')} placeholder="Penicillin, peanuts" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conditions">Conditions (comma-separated)</Label>
              <Input id="conditions" value={form.conditions} onChange={set('conditions')} placeholder="Asthma, hypertension" />
            </div>
          </div>
          <div className="space-y-3">
            <Label>Emergency contacts</Label>
            {contacts.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <Input aria-label="Name" placeholder="Name" value={c.name} onChange={(e) => setContacts(contacts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Input aria-label="Relation" placeholder="Relation" value={c.relation ?? ''} onChange={(e) => setContacts(contacts.map((x, j) => (j === i ? { ...x, relation: e.target.value } : x)))} />
                <Input aria-label="Phone" placeholder="Phone" value={c.phone} onChange={(e) => setContacts(contacts.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove contact" onClick={() => setContacts(contacts.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            {contacts.length < 5 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setContacts([...contacts, { name: '', relation: '', phone: '' }])}>
                <Plus /> Add contact
              </Button>
            )}
          </div>
          <Button type="submit" disabled={save.isPending}>
            <Save /> Save profile
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AvailabilityForm({ doctor }: { doctor: Doctor }) {
  const initial = DAYS.map((_, d) => {
    const w = doctor.availability.filter((x) => x.dayOfWeek === d);
    return { on: w.length > 0, start: w[0]?.start ?? '09:00', end: w.at(-1)?.end ?? '17:00', lunch: w.length > 1 };
  });
  const [days, setDays] = useState(initial);
  const [accepting, setAccepting] = useState(doctor.acceptingPatients);
  const save = useApiMutation<void>(
    () => ({
      path: '/me/availability',
      method: 'PUT',
      body: {
        acceptingPatients: accepting,
        availability: days.flatMap((d, i) =>
          !d.on ? [] : d.lunch && d.start < '13:00' && d.end > '14:00'
            ? [{ dayOfWeek: i, start: d.start, end: '13:00' }, { dayOfWeek: i, start: '14:00', end: d.end }]
            : [{ dayOfWeek: i, start: d.start, end: d.end }],
        ),
      },
    }),
    { invalidate: [['me']], success: 'Availability updated' },
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly availability</CardTitle>
        <CardDescription>Patients can book 30-minute slots inside these hours.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Label className="flex items-center gap-3 font-normal">
          <Switch checked={accepting} onCheckedChange={setAccepting} /> Accepting new appointments
        </Label>
        <div className="divide-y rounded-lg border">
          {days.map((d, i) => (
            <div key={DAYS[i]} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <Switch checked={d.on} onCheckedChange={(on) => setDays(days.map((x, j) => (j === i ? { ...x, on } : x)))} aria-label={`${DAYS[i]} available`} />
              <span className="w-24 text-sm font-medium">{DAYS[i]}</span>
              {d.on ? (
                <>
                  <Input type="time" step={1800} className="w-28" value={d.start} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input type="time" step={1800} className="w-28" value={d.end} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                  <Label className="text-muted-foreground flex items-center gap-2 text-xs font-normal">
                    <Switch checked={d.lunch} onCheckedChange={(lunch) => setDays(days.map((x, j) => (j === i ? { ...x, lunch } : x)))} /> Lunch 13–14
                  </Label>
                </>
              ) : (
                <span className="text-muted-foreground text-sm">Unavailable</span>
              )}
            </div>
          ))}
        </div>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          <Save /> Save availability
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  const me = useMe();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(Boolean(me.data)), [me.data]);
  if (!ready || !me.data) return <Skeleton className="h-96" />;
  const { user, roles, patient, doctor } = me.data;
  return (
    <div className="space-y-6">
      <PageHeader title="Profile & settings" description="Your identity is managed by MedEtherial ID (Keycloak)." />
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="text-muted-foreground text-sm">{user.email}</p>
            <div className="flex flex-wrap gap-1 pt-1">{roles.map((r) => <Badge key={r} variant="secondary">{ROLE_LABELS[r]}</Badge>)}</div>
          </div>
          {accountUrl && (
            <Button asChild variant="outline">
              <a href={accountUrl} target="_blank" rel="noreferrer">
                Password & security <ExternalLink />
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
      <MyRolesCard roles={roles} />
      {patient && <PatientProfileForm patient={patient} />}
      {doctor && <AvailabilityForm doctor={doctor} />}
    </div>
  );
}
