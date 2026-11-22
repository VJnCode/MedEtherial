import {
  SLOT_MINUTES,
  canTransitionAppointment,
  type AppointmentStatus,
  type CreateAppointment,
} from '@medetherial/shared';
import type { AuthContext } from '../auth/context.js';
import { env } from '../config/env.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { addMinutes, dayOfWeek, zonedDate, zonedToUtc } from '../lib/time.js';
import { Appointment, Doctor } from '../models/index.js';
import { doctorOf, patientIdOf } from './access.service.js';

export interface Slot {
  startsAt: string;
  endsAt: string;
  available: boolean;
}

type Availability = { dayOfWeek: number; start: string; end: string }[];

/** Expands a doctor's weekly availability into slot start/end instants for one calendar day. */
export function expandSlots(availability: Availability, date: string, tz = env.CLINIC_TIMEZONE) {
  const dow = dayOfWeek(date);
  const slots: { start: Date; end: Date }[] = [];
  for (const w of availability.filter((x) => x.dayOfWeek === dow)) {
    for (let t = w.start; addMinutes(t, SLOT_MINUTES) <= w.end; t = addMinutes(t, SLOT_MINUTES)) {
      slots.push({ start: zonedToUtc(date, t, tz), end: zonedToUtc(date, addMinutes(t, SLOT_MINUTES), tz) });
    }
  }
  return slots;
}

/** Bookable slots for one calendar day, flagged with availability. */
export async function getSlots(doctorId: string, date: string): Promise<Slot[]> {
  const doctor = await Doctor.findById(doctorId).lean();
  if (!doctor) throw notFound('Doctor not found');
  const slots = expandSlots(doctor.availability, date);
  if (!slots.length) return [];
  const taken = await Appointment.find(
    { doctor: doctorId, holdsSlot: true, startsAt: { $gte: slots[0]!.start, $lte: slots.at(-1)!.start } },
    { startsAt: 1 },
  ).lean();
  const takenSet = new Set(taken.map((a) => a.startsAt.getTime()));
  const now = Date.now();
  return slots.map((s) => ({
    startsAt: s.start.toISOString(),
    endsAt: s.end.toISOString(),
    available: s.start.getTime() > now && !takenSet.has(s.start.getTime()),
  }));
}

export async function bookAppointment(input: CreateAppointment, auth: AuthContext) {
  const patientId = await patientIdOf(auth);
  if (!patientId) throw forbidden('Only patients can book appointments');
  const doctor = await Doctor.findById(input.doctorId);
  if (!doctor) throw notFound('Doctor not found');
  if (!doctor.acceptingPatients) throw conflict('Doctor is not accepting new appointments');

  const startsAt = input.startsAt;
  if (startsAt.getTime() <= Date.now()) throw badRequest('Appointment must be in the future');

  // Slot must lie exactly on the doctor's published availability grid.
  const date = zonedDate(startsAt, env.CLINIC_TIMEZONE);
  const onGrid = expandSlots(doctor.availability, date).some((s) => s.start.getTime() === startsAt.getTime());
  if (!onGrid) throw badRequest('Selected time is outside the doctor’s availability');

  const endsAt = new Date(startsAt.getTime() + SLOT_MINUTES * 60_000);
  const clash = await Appointment.exists({ patient: patientId, holdsSlot: true, startsAt });
  if (clash) throw conflict('You already have an appointment at this time');

  try {
    return await Appointment.create({
      patient: patientId,
      doctor: doctor._id,
      startsAt,
      endsAt,
      reason: input.reason,
      status: 'requested',
      holdsSlot: true,
      history: [{ status: 'requested', at: new Date(), by: auth.userId }],
    });
  } catch (err) {
    // Unique partial index (doctor, startsAt) closes the race window between check and insert.
    if ((err as { code?: number }).code === 11000) throw conflict('This slot has just been booked. Please pick another.');
    throw err;
  }
}

export async function changeAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  auth: AuthContext,
  note?: string,
) {
  const appt = await Appointment.findById(id);
  if (!appt) throw notFound('Appointment not found');

  const isAdmin = auth.roles.includes('admin');
  const doctor = auth.roles.includes('doctor') ? await doctorOf(auth) : null;
  const isDoctor = Boolean(doctor && String(doctor._id) === String(appt.doctor));
  const pid = auth.roles.includes('patient') ? await patientIdOf(auth) : undefined;
  const isPatient = Boolean(pid && String(pid) === String(appt.patient));

  if (!isAdmin && !isDoctor && !(isPatient && status === 'cancelled')) throw forbidden();
  if (!canTransitionAppointment(appt.status as AppointmentStatus, status)) {
    throw conflict(`Cannot change appointment from ${appt.status} to ${status}`);
  }
  if (status === 'completed' && appt.startsAt.getTime() > Date.now()) {
    throw conflict('Cannot complete an appointment before it starts');
  }

  appt.status = status;
  if (status === 'cancelled' || status === 'no_show') appt.holdsSlot = false;
  appt.history.push({ status, at: new Date(), by: auth.userId, note });
  await appt.save();
  return appt;
}
