'use client';

import { BLOOD_GROUPS } from '@medetherial/shared';
import { format } from 'date-fns';
import { Ambulance, ClipboardList, FileText, HeartPulse, Pill, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState, IncidentStatusBadge, SeverityBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlay';
import { Badge, Input, Label, Textarea } from '@/components/ui/primitives';
import { useApiMutation } from '@/lib/api';
import type { Encounter, Incident, Patient, Prescription } from '@/lib/types';
import { humanize } from '@/lib/utils';

export function PatientSummary({ patient }: { patient: Patient }) {
  const age = patient.dateOfBirth ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 86_400_000)) : null;
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>{patient.user?.name}</CardTitle>
        <p className="text-muted-foreground font-mono text-xs">{patient.mrn}</p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ['Age', age ?? '—'],
            ['Sex', patient.gender ? humanize(patient.gender) : '—'],
            ['Blood', patient.bloodGroup ?? '—'],
          ].map(([k, v]) => (
            <div key={k as string} className="bg-muted/60 rounded-lg py-2">
              <p className="text-muted-foreground text-[10px] uppercase">{k}</p>
              <p className="font-semibold">{v}</p>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-medium uppercase">Allergies</p>
          <div className="flex flex-wrap gap-1.5">
            {patient.allergies.length ? patient.allergies.map((a) => <Badge key={a} variant="destructive">{a}</Badge>) : <span className="text-muted-foreground">None recorded</span>}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-medium uppercase">Conditions</p>
          <div className="flex flex-wrap gap-1.5">
            {patient.conditions.length ? patient.conditions.map((c) => <Badge key={c} variant="secondary">{c}</Badge>) : <span className="text-muted-foreground">None recorded</span>}
          </div>
        </div>
        {patient.emergencyContacts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium uppercase">Emergency contacts</p>
            {patient.emergencyContacts.map((c) => (
              <p key={c.phone}>
                {c.name} {c.relation && <span className="text-muted-foreground">({c.relation})</span>} · <a className="text-primary" href={`tel:${c.phone}`}>{c.phone}</a>
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EncounterTimeline({ items }: { items: Encounter[] }) {
  if (!items.length) return <EmptyState icon={ClipboardList} title="No clinical notes yet" />;
  return (
    <ol className="relative space-y-6 border-l pl-6">
      {items.map((e) => (
        <li key={e.id} className="relative">
          <span className="bg-primary ring-background absolute top-1 -left-[29px] size-3 rounded-full ring-4" />
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{humanize(e.type)}</p>
            <span className="text-muted-foreground text-xs">{format(new Date(e.createdAt), 'd MMM yyyy, HH:mm')}</span>
            {e.author && <span className="text-muted-foreground text-xs">· {e.author.name}</span>}
          </div>
          {e.diagnosis && <p className="text-primary mt-1 text-sm font-medium">{e.diagnosis}</p>}
          <p className="text-muted-foreground mt-1 text-sm whitespace-pre-line">{e.summary}</p>
          {e.vitals && Object.keys(e.vitals).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {e.vitals.heartRate && <Badge variant="outline"><HeartPulse /> {e.vitals.heartRate} bpm</Badge>}
              {e.vitals.systolic && <Badge variant="outline">BP {e.vitals.systolic}/{e.vitals.diastolic}</Badge>}
              {e.vitals.spo2 && <Badge variant="outline">SpO₂ {e.vitals.spo2}%</Badge>}
              {e.vitals.temperature && <Badge variant="outline">{e.vitals.temperature} °C</Badge>}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

export function PrescriptionList({ items }: { items: Prescription[] }) {
  if (!items.length) return <EmptyState icon={Pill} title="No prescriptions" />;
  return (
    <div className="space-y-4">
      {items.map((p) => {
        const active = !p.validUntil || new Date(p.validUntil) > new Date();
        return (
          <Card key={p.id} className="gap-3 py-4">
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{p.doctor?.user?.name ?? 'Prescriber'}</p>
                  <p className="text-muted-foreground text-xs">
                    {p.doctor?.specialty} · issued {format(new Date(p.issuedAt), 'd MMM yyyy')}
                  </p>
                </div>
                <Badge variant={active ? 'success' : 'muted'}>{active ? 'Active' : 'Expired'}</Badge>
              </div>
              <ul className="divide-y rounded-lg border">
                {p.medications.map((m, i) => (
                  <li key={i} className="flex flex-col gap-0.5 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium">
                      {m.name} <span className="text-muted-foreground font-normal">{m.dosage}</span>
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {m.frequency} · {m.durationDays} days{m.instructions ? ` · ${m.instructions}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
              {p.notes && <p className="text-muted-foreground text-sm">{p.notes}</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function IncidentHistory({ items }: { items: Incident[] }) {
  if (!items.length) return <EmptyState icon={Ambulance} title="No emergencies on record" />;
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.id}>
          <Link href={`/app/incidents/${i.id}`} className="hover:bg-muted/50 flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm">
            <span className="font-mono text-xs font-semibold">{i.reference}</span>
            <SeverityBadge severity={i.severity} />
            <IncidentStatusBadge status={i.status} />
            <span className="text-muted-foreground">{i.symptoms.join(', ')}</span>
            <span className="text-muted-foreground ml-auto text-xs">{format(new Date(i.createdAt), 'd MMM yyyy')}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Doctor write actions ---------------- */
export function NoteDialog({ patientId, onDone }: { patientId: string; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('consultation');
  const [summary, setSummary] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [hr, setHr] = useState('');
  const [sys, setSys] = useState('');
  const [dia, setDia] = useState('');
  const [spo2, setSpo2] = useState('');
  const save = useApiMutation<void>(
    () => ({
      path: '/encounters',
      body: {
        patientId,
        type,
        summary,
        diagnosis: diagnosis || undefined,
        vitals: Object.fromEntries(
          Object.entries({ heartRate: hr, systolic: sys, diastolic: dia, spo2 }).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]),
        ),
      },
    }),
    {
      invalidate: [['records', patientId]],
      success: 'Clinical note saved',
      onSuccess: () => {
        setOpen(false);
        setSummary('');
        setDiagnosis('');
        onDone?.();
      },
    },
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText /> Add note
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Clinical note</DialogTitle>
          <DialogDescription>Saved to the patient’s record and audit-logged.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['consultation', 'follow_up', 'emergency'].map((t) => <SelectItem key={t} value={t}>{humanize(t)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dx">Diagnosis</Label>
              <Input id="dx" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="e.g. Essential hypertension (I10)" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary">Assessment & plan</Label>
            <Textarea id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={5} />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              ['HR', hr, setHr],
              ['Sys', sys, setSys],
              ['Dia', dia, setDia],
              ['SpO₂', spo2, setSpo2],
            ].map(([l, v, set]) => (
              <div key={l as string} className="space-y-1.5">
                <Label>{l as string}</Label>
                <Input type="number" value={v as string} onChange={(e) => (set as (s: string) => void)(e.target.value)} />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!summary.trim() || save.isPending} onClick={() => save.mutate()}>
            Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const EMPTY_MED = { name: '', dosage: '', frequency: '', durationDays: 7, instructions: '' };

export function PrescriptionDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const [meds, setMeds] = useState([{ ...EMPTY_MED }]);
  const [notes, setNotes] = useState('');
  const save = useApiMutation<void>(
    () => ({
      path: '/prescriptions',
      body: { patientId, notes: notes || undefined, medications: meds.map((m) => ({ ...m, instructions: m.instructions || undefined })) },
    }),
    {
      invalidate: [['records', patientId]],
      success: 'Prescription issued',
      onSuccess: () => {
        setOpen(false);
        setMeds([{ ...EMPTY_MED }]);
        setNotes('');
      },
    },
  );
  const valid = meds.every((m) => m.name && m.dosage && m.frequency && m.durationDays > 0);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Pill /> Prescribe
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New prescription</DialogTitle>
          <DialogDescription>The patient sees this immediately in their records.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {meds.map((m, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border p-3 sm:grid-cols-[2fr_1fr_1.5fr_0.8fr_auto]">
              <Input aria-label="Medicine" placeholder="Medicine" value={m.name} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <Input aria-label="Dosage" placeholder="Dose" value={m.dosage} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, dosage: e.target.value } : x)))} />
              <Input aria-label="Frequency" placeholder="Frequency" value={m.frequency} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, frequency: e.target.value } : x)))} />
              <Input aria-label="Days" type="number" min={1} value={m.durationDays} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, durationDays: Number(e.target.value) } : x)))} />
              <Button variant="ghost" size="icon" aria-label="Remove" disabled={meds.length === 1} onClick={() => setMeds(meds.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
              <Input className="col-span-full" aria-label="Instructions" placeholder="Instructions (optional)" value={m.instructions} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, instructions: e.target.value } : x)))} />
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setMeds([...meds, { ...EMPTY_MED }])}>
            <Plus /> Add medicine
          </Button>
          <Textarea placeholder="Notes for the patient (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            Issue prescription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { BLOOD_GROUPS };
