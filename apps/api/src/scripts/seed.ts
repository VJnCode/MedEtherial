/* eslint-disable no-console */
import { toPoint, type LatLng, type Severity } from '@medetherial/shared';
import mongoose from 'mongoose';
import { connectDb, disconnectDb, syncIndexes } from '../db.js';
import { zonedDate } from '../lib/time.js';
import { env } from '../config/env.js';
import {
  Ambulance,
  Appointment,
  AuditLog,
  Doctor,
  Encounter,
  Hospital,
  Incident,
  LocationPing,
  Patient,
  Prescription,
  User,
  generateIncidentRef,
  generateMrn,
} from '../models/index.js';
import { expandSlots } from '../services/appointment.service.js';
import { DEMO_USERS } from './demo-users.js';

const reset = process.argv.includes('--reset');

const HOSPITALS: { name: string; address: string; phone: string; at: LatLng; specialties: string[]; beds: number; trauma: boolean }[] = [
  { name: 'Cauvery Valley Medical Centre', address: 'Sayyaji Rao Rd, Mysuru', phone: '+91 821 400 1000', at: { lat: 12.3106, lng: 76.6526 }, specialties: ['Cardiology', 'Emergency Medicine', 'Neurology'], beds: 24, trauma: true },
  { name: 'Palace Road General Hospital', address: 'Palace Rd, Mysuru', phone: '+91 821 400 2000', at: { lat: 12.3008, lng: 76.6481 }, specialties: ['General Medicine', 'Pediatrics', 'Obstetrics'], beds: 16, trauma: false },
  { name: 'Kuvempunagar Trauma & Ortho Centre', address: 'Kuvempunagar, Mysuru', phone: '+91 821 400 3000', at: { lat: 12.2853, lng: 76.6219 }, specialties: ['Orthopedics', 'Emergency Medicine', 'Burns'], beds: 20, trauma: true },
  { name: 'Vijayanagar Children’s Hospital', address: 'Vijayanagar 2nd Stage, Mysuru', phone: '+91 821 400 4000', at: { lat: 12.3326, lng: 76.6113 }, specialties: ['Pediatrics', 'Neonatology'], beds: 12, trauma: false },
  { name: 'Hebbal Community Health Centre', address: 'Hebbal Industrial Area, Mysuru', phone: '+91 821 400 5000', at: { lat: 12.3505, lng: 76.6205 }, specialties: ['General Medicine', 'Emergency Medicine'], beds: 10, trauma: false },
];

const WEEKDAY_HOURS = [1, 2, 3, 4, 5, 6].flatMap((d) => [
  { dayOfWeek: d, start: '09:00', end: '13:00' },
  { dayOfWeek: d, start: '14:00', end: '17:00' },
]);

const jitter = (p: LatLng, m = 0.01): LatLng => ({ lat: p.lat + (Math.random() - 0.5) * m, lng: p.lng + (Math.random() - 0.5) * m });
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

async function upsertUser(u: (typeof DEMO_USERS)[keyof typeof DEMO_USERS], extra: Record<string, unknown> = {}) {
  return User.findOneAndUpdate(
    { sub: u.sub },
    { $set: { email: u.email, name: u.name, roles: u.roles, ...extra } },
    { upsert: true, new: true },
  );
}

function slotOn(availability: typeof WEEKDAY_HOURS, offsetDays: number, index: number) {
  for (let d = offsetDays; Math.abs(d) < Math.abs(offsetDays) + 7; d += offsetDays >= 0 ? 1 : -1) {
    const slots = expandSlots(availability, zonedDate(daysFromNow(d), env.CLINIC_TIMEZONE));
    if (slots.length) return slots[Math.min(index, slots.length - 1)]!;
  }
  throw new Error('no slot');
}

async function main() {
  await connectDb();
  if (reset) {
    console.log('↺ Resetting domain collections…');
    await Promise.all(
      ([Appointment, Doctor, Encounter, Hospital, Incident, Patient, Prescription, Ambulance, User] as unknown as mongoose.Model<unknown>[]).map((m) => m.deleteMany({})),
    );
    await mongoose.connection.db?.dropCollection('auditlogs').catch(() => undefined);
    await mongoose.connection.db?.dropCollection('locationpings').catch(() => undefined);
  }
  await syncIndexes();

  if (!reset && (await Hospital.countDocuments()) > 0) {
    console.log('✓ Data already present — run with --reset to re-seed.');
    await disconnectDb();
    return;
  }

  console.log('→ Hospitals');
  const hospitals = await Hospital.insertMany(
    HOSPITALS.map((h) => ({
      name: h.name,
      address: h.address,
      phone: h.phone,
      location: toPoint(h.at),
      specialties: h.specialties,
      erBedsTotal: h.beds,
      erBedsAvailable: Math.floor(h.beds * (0.4 + Math.random() * 0.5)),
      traumaCenter: h.trauma,
    })),
  );
  const [cauvery, palace, kuvempu, vijay] = hospitals as [typeof hospitals[0], typeof hospitals[0], typeof hospitals[0], typeof hospitals[0]];

  console.log('→ Users');
  const admin = await upsertUser(DEMO_USERS.admin);
  await upsertUser(DEMO_USERS.dispatcher);
  const paramedic = await upsertUser(DEMO_USERS.paramedic, { hospital: cauvery._id, phone: '+91 98450 11111' });
  await upsertUser(DEMO_USERS.hospitalAdmin, { hospital: cauvery._id });
  const drRaoU = await upsertUser(DEMO_USERS.drRao);
  const drMenonU = await upsertUser(DEMO_USERS.drMenon);
  const drIyerU = await upsertUser(DEMO_USERS.drIyer);
  const drShettyU = await upsertUser(DEMO_USERS.drShetty);
  const patientU = await upsertUser(DEMO_USERS.patient, { phone: '+91 98860 22222' });
  const patient2U = await upsertUser(DEMO_USERS.patient2, { phone: '+91 98860 33333' });

  console.log('→ Doctors');
  const doctorDefs = [
    { user: drRaoU, specialty: 'Cardiology', hospital: cauvery, years: 14, fee: 900, bio: 'Interventional cardiologist focused on preventive heart care.' },
    { user: drMenonU, specialty: 'Emergency Medicine', hospital: cauvery, years: 10, fee: 700, bio: 'Leads the emergency department and pre-hospital care protocols.' },
    { user: drIyerU, specialty: 'Pediatrics', hospital: vijay, years: 8, fee: 600, bio: 'Paediatrician with a special interest in childhood asthma.' },
    { user: drShettyU, specialty: 'Orthopedics', hospital: kuvempu, years: 12, fee: 800, bio: 'Trauma and joint-replacement surgeon.' },
  ];
  const doctors = await Doctor.insertMany(
    doctorDefs.map((d) => ({
      user: d.user._id,
      specialty: d.specialty,
      hospital: d.hospital._id,
      licenseNo: `KMC-${Math.floor(10000 + Math.random() * 89999)}`,
      bio: d.bio,
      yearsExperience: d.years,
      consultationFee: d.fee,
      rating: Math.round((4.3 + Math.random() * 0.7) * 10) / 10,
      languages: ['English', 'Kannada', 'Hindi'],
      availability: WEEKDAY_HOURS,
    })),
  );
  const [drRao, drMenon] = doctors as [typeof doctors[0], typeof doctors[0]];

  console.log('→ Patients');
  const priya = await Patient.create({
    user: patientU._id,
    mrn: generateMrn(),
    dateOfBirth: new Date('1988-04-12'),
    gender: 'female',
    bloodGroup: 'B+',
    phone: '+91 98860 22222',
    address: '14, 3rd Cross, Saraswathipuram, Mysuru',
    allergies: ['Penicillin'],
    conditions: ['Hypertension'],
    emergencyContacts: [{ name: 'Arun Sharma', relation: 'Spouse', phone: '+91 98860 44444' }],
  });
  const rahul = await Patient.create({
    user: patient2U._id,
    mrn: generateMrn(),
    dateOfBirth: new Date('1957-09-30'),
    gender: 'male',
    bloodGroup: 'O+',
    phone: '+91 98860 33333',
    address: '221, Gokulam 3rd Stage, Mysuru',
    allergies: [],
    conditions: ['Type 2 Diabetes', 'Coronary artery disease'],
    emergencyContacts: [{ name: 'Sneha Verma', relation: 'Daughter', phone: '+91 98860 55555' }],
  });

  console.log('→ Appointments, encounters, prescriptions');
  const past = slotOn(WEEKDAY_HOURS, -10, 2);
  const pastAppt = await Appointment.create({
    patient: priya._id, doctor: drRao._id, startsAt: past.start, endsAt: past.end,
    reason: 'Blood pressure review', status: 'completed', holdsSlot: true,
    history: [{ status: 'requested', at: daysFromNow(-14) }, { status: 'confirmed', at: daysFromNow(-13) }, { status: 'completed', at: past.end }],
  });
  await Encounter.create({
    patient: priya._id, author: drRaoU._id, authorRole: 'doctor', appointment: pastAppt._id, type: 'consultation',
    summary: 'BP 142/92 on two readings. Lifestyle counselling given. Start low-dose ARB, review in 4 weeks.',
    diagnosis: 'Essential hypertension (I10)', vitals: { heartRate: 78, systolic: 142, diastolic: 92, spo2: 98, temperature: 36.8 },
  });
  await Prescription.create({
    patient: priya._id, doctor: drRao._id, appointment: pastAppt._id, issuedAt: past.end, validUntil: daysFromNow(20),
    medications: [
      { name: 'Telmisartan', dosage: '40 mg', frequency: 'Once daily (morning)', durationDays: 30 },
      { name: 'Amlodipine', dosage: '5 mg', frequency: 'Once daily (night)', durationDays: 30, instructions: 'Report ankle swelling' },
    ],
    notes: 'Low-salt diet, 30 min walk daily.',
  });
  const next = slotOn(WEEKDAY_HOURS, 2, 4);
  await Appointment.create({
    patient: priya._id, doctor: drRao._id, startsAt: next.start, endsAt: next.end, reason: 'Hypertension follow-up',
    status: 'confirmed', holdsSlot: true, history: [{ status: 'requested', at: new Date() }, { status: 'confirmed', at: new Date() }],
  });
  const soon = slotOn(WEEKDAY_HOURS, 1, 1);
  await Appointment.create({
    patient: rahul._id, doctor: drRao._id, startsAt: soon.start, endsAt: soon.end, reason: 'Exertional chest discomfort',
    status: 'requested', holdsSlot: true, history: [{ status: 'requested', at: new Date() }],
  });
  const soon2 = slotOn(WEEKDAY_HOURS, 3, 0);
  await Appointment.create({
    patient: rahul._id, doctor: drMenon._id, startsAt: soon2.start, endsAt: soon2.end, reason: 'Diabetes review',
    status: 'confirmed', holdsSlot: true, history: [{ status: 'requested', at: new Date() }, { status: 'confirmed', at: new Date() }],
  });

  console.log('→ Ambulance fleet');
  const fleetDefs: { callsign: string; type: 'ALS' | 'BLS'; base: typeof cauvery }[] = [
    { callsign: 'MYS-ALS-01', type: 'ALS', base: cauvery },
    { callsign: 'MYS-ALS-02', type: 'ALS', base: kuvempu },
    { callsign: 'MYS-ALS-03', type: 'ALS', base: hospitals[4]! },
    { callsign: 'MYS-BLS-01', type: 'BLS', base: palace },
    { callsign: 'MYS-BLS-02', type: 'BLS', base: vijay },
    { callsign: 'MYS-BLS-03', type: 'BLS', base: cauvery },
    { callsign: 'MYS-BLS-04', type: 'BLS', base: kuvempu },
    { callsign: 'MYS-BLS-05', type: 'BLS', base: palace },
  ];
  const fleet = await Ambulance.insertMany(
    fleetDefs.map((f, i) => ({
      callsign: f.callsign,
      plate: `KA-09-AM-${String(1001 + i)}`,
      type: f.type,
      status: i === 7 ? 'maintenance' : 'available',
      crew: i === 0 ? [paramedic._id] : [],
      baseHospital: f.base._id,
      location: toPoint(jitter({ lat: f.base.location.coordinates[1]!, lng: f.base.location.coordinates[0]! }, 0.006)),
      lastSeenAt: new Date(),
      simulated: true,
    })),
  );

  console.log('→ Historical incidents (last 7 days)');
  const symptomsPool: [string[], Severity][] = [
    [['Chest pain'], 'high'], [['Road accident', 'Fracture'], 'high'], [['Fever', 'Vomiting'], 'moderate'],
    [['Unconscious'], 'critical'], [['Fall'], 'moderate'], [['Stroke'], 'critical'], [['Dizziness'], 'moderate'],
  ];
  const history = Array.from({ length: 28 }, (_, i) => {
    const created = new Date(Date.now() - Math.random() * 7 * 86_400_000);
    const response = (6 + Math.random() * 12) * 60_000;
    const [symptoms, severity] = symptomsPool[i % symptomsPool.length]!;
    const hospital = hospitals[i % hospitals.length]!;
    const amb = fleet[i % 7]!;
    const onScene = new Date(created.getTime() + response);
    const atHosp = new Date(onScene.getTime() + (10 + Math.random() * 15) * 60_000);
    return {
      reference: generateIncidentRef(),
      patient: i % 5 === 0 ? rahul._id : undefined,
      reportedBy: admin._id,
      location: toPoint(jitter({ lat: 12.3, lng: 76.64 }, 0.08)),
      address: 'Mysuru',
      symptoms,
      severity,
      status: 'closed',
      ambulance: amb._id,
      hospital: hospital._id,
      assignedAt: new Date(created.getTime() + 30_000),
      onSceneAt: onScene,
      atHospitalAt: atHosp,
      closedAt: new Date(atHosp.getTime() + 15 * 60_000),
      timeline: [
        { status: 'requested', at: created },
        { status: 'assigned', at: new Date(created.getTime() + 30_000) },
        { status: 'en_route', at: new Date(created.getTime() + 60_000) },
        { status: 'on_scene', at: onScene },
        { status: 'transporting', at: new Date(onScene.getTime() + 8 * 60_000) },
        { status: 'at_hospital', at: atHosp },
        { status: 'closed', at: new Date(atHosp.getTime() + 15 * 60_000) },
      ],
      createdAt: created,
      updatedAt: atHosp,
    };
  });
  await Incident.collection.insertMany(history);

  await AuditLog.create({ action: 'system.seed', resourceType: 'System', actorName: 'seed-script' });
  void LocationPing; // collection created by syncIndexes

  console.log('\n✓ Seed complete');
  console.log(`  ${hospitals.length} hospitals · ${doctors.length} doctors · 2 patients · ${fleet.length} ambulances · ${history.length} past incidents`);
  await disconnectDb();
}

main().catch(async (err: unknown) => {
  console.error(err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
