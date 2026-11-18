import {
  Activity,
  ArrowRight,
  BellRing,
  CalendarCheck2,
  FileLock2,
  FileText,
  Fingerprint,
  Gauge,
  HeartPulse,
  Hospital,
  KeyRound,
  MapPinned,
  Navigation,
  Radio,
  ScrollText,
  Siren,
  Stethoscope,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { HeroVisual } from '@/components/marketing/hero-visual';
import { FadeIn, Reveal } from '@/components/marketing/reveal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';

const FEATURES = [
  { icon: CalendarCheck2, title: 'Conflict-free scheduling', body: 'Doctors publish weekly availability. Patients book 30-minute slots that can never be double-booked, enforced at the database level.' },
  { icon: FileText, title: 'Unified health record', body: 'Visit notes, vitals, diagnoses and prescriptions on one timeline, visible only to the patient and their treating clinicians.' },
  { icon: Siren, title: 'One-tap SOS', body: 'Patients raise an emergency with their GPS location and symptoms. Severity is triaged instantly and the nearest suitable unit is dispatched.' },
  { icon: MapPinned, title: 'Live ambulance tracking', body: 'Crew devices stream GPS over WebSockets, so patients, dispatchers and the receiving ER all watch the same live position and ETA.' },
  { icon: Hospital, title: 'Smart hospital routing', body: 'Destination is chosen by distance, live ER bed availability and trauma capability, and the receiving team is pre-alerted with vitals.' },
  { icon: Gauge, title: 'Operational insight', body: 'Response-time KPIs, fleet availability and ER capacity at a glance for dispatch supervisors and administrators.' },
];

const STEPS = [
  { icon: BellRing, title: 'SOS raised', body: 'Location and symptoms are captured from the patient’s phone or entered by a dispatcher.' },
  { icon: Activity, title: 'Auto-triage & dispatch', body: 'Critical cases get Advanced Life Support units first. The unit is claimed atomically, so two dispatchers can never double-assign it.' },
  { icon: Navigation, title: 'Live route & ETA', body: 'OpenStreetMap routing draws the fastest path, and the ETA updates with every GPS fix.' },
  { icon: HeartPulse, title: 'Hospital handover', body: 'Crew records vitals en route, and the receiving ER sees the patient summary before arrival.' },
];

const ROLES = [
  { icon: Users, role: 'Patients', points: ['Book and manage visits', 'Prescriptions and records', 'SOS with live tracking'] },
  { icon: Stethoscope, role: 'Doctors', points: ['Daily schedule and requests', 'Clinical notes and e-prescriptions', 'Incoming emergency alerts'] },
  { icon: Radio, role: 'Paramedics', points: ['Assignment console', 'GPS sharing from the device', 'Status updates and vitals'] },
  { icon: MapPinned, role: 'Dispatchers', points: ['Live fleet map', 'Prioritised incident queue', 'Manual reassignment'] },
];

const SECURITY = [
  { icon: KeyRound, title: 'OAuth 2.0 / OpenID Connect', body: 'Single sign-on through Keycloak using Authorization Code + PKCE. Passwords never touch our application servers.' },
  { icon: Fingerprint, title: 'Fine-grained RBAC', body: 'Six roles map to explicit permissions, and every API call also checks that the record belongs to the caller.' },
  { icon: ScrollText, title: 'Immutable audit trail', body: 'Every access to health data is written to an append-only audit log with actor, IP and request ID.' },
  { icon: FileLock2, title: 'Hardened by default', body: 'Strict CSP, HSTS, rate limiting, schema validation on every request, and GPS history that expires automatically.' },
];

export default function LandingPage() {
  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pt-16 pb-24 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div className="space-y-7">
            <FadeIn>
              <Badge variant="outline" className="bg-background gap-2 px-3 py-1 text-xs">
                <span className="bg-success size-1.5 rounded-full" /> Live GPS dispatch is now available
              </Badge>
            </FadeIn>
            <FadeIn delay={0.05}>
              <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Care that keeps moving, <span className="from-primary bg-gradient-to-r to-sky-500 bg-clip-text text-transparent">even in an emergency.</span>
              </h1>
            </FadeIn>
            <FadeIn delay={0.1}>
              <p className="text-muted-foreground max-w-xl text-lg text-balance">
                MedEtherial brings appointments, health records and ambulance dispatch onto one secure platform. Patients, doctors, paramedics and
                dispatchers all see the same live picture.
              </p>
            </FadeIn>
            <FadeIn delay={0.15} className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/login?mode=register">
                  Create your account <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
            </FadeIn>
            <FadeIn delay={0.2} className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm">
              <span className="flex items-center gap-2">
                <KeyRound className="text-primary size-4" /> Single sign-on (OIDC)
              </span>
              <span className="flex items-center gap-2">
                <MapPinned className="text-primary size-4" /> Open-source maps
              </span>
              <span className="flex items-center gap-2">
                <ScrollText className="text-primary size-4" /> Full audit trail
              </span>
            </FadeIn>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* ---------- Stats ---------- */}
      <section className="bg-muted/40 border-y">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
          {[
            ['< 2 s', 'Dispatch decision'],
            ['Live', 'GPS updates over WebSocket'],
            ['6', 'Purpose-built roles'],
            ['100%', 'Health-data access audited'],
          ].map(([v, l], i) => (
            <Reveal key={l} delay={i * 0.05} className="space-y-1">
              <p className="font-mono text-3xl font-semibold tracking-tight">{v}</p>
              <p className="text-muted-foreground text-sm">{l}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6">
        <Reveal className="mx-auto max-w-2xl space-y-3 text-center">
          <p className="text-primary text-xs font-semibold tracking-widest uppercase">Platform</p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Everything between the first symptom and the hospital bed</h2>
          <p className="text-muted-foreground">One system of record for routine care and emergencies, built for clinical teams.</p>
        </Reveal>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.06} className="group bg-card relative rounded-2xl border p-6 transition-shadow hover:shadow-lg">
              <div className="bg-primary/10 text-primary mb-4 inline-flex rounded-xl p-2.5 transition-transform group-hover:scale-110">
                <f.icon className="size-5" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{f.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- Emergency flow ---------- */}
      <section id="emergency" className="bg-foreground text-background scroll-mt-16 dark:bg-card dark:text-foreground">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <Reveal className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold tracking-widest text-teal-300 uppercase dark:text-primary">Emergency response</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">From SOS to handover in four connected steps</h2>
            <p className="opacity-70">Every step is a guarded state transition. Roles decide who can move an incident forward, and every change reaches everyone watching in real time.</p>
          </Reveal>
          <ol className="relative mt-14 grid gap-6 md:grid-cols-4">
            <div className="absolute top-6 right-8 left-8 hidden h-px bg-gradient-to-r from-teal-400/0 via-teal-400/60 to-teal-400/0 md:block" />
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.1} className="relative space-y-3">
                <div className="relative grid size-12 place-items-center rounded-full border border-white/15 bg-white/5 dark:border-border dark:bg-muted">
                  <s.icon className="size-5 text-teal-300 dark:text-primary" />
                </div>
                <p className="font-mono text-xs opacity-50">0{i + 1}</p>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm leading-relaxed opacity-70">{s.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Roles ---------- */}
      <section id="roles" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6">
        <Reveal className="mx-auto max-w-2xl space-y-3 text-center">
          <p className="text-primary text-xs font-semibold tracking-widest uppercase">For every team</p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">A workspace shaped around each role</h2>
          <p className="text-muted-foreground">Everyone signs in once and lands in a workspace built around their job.</p>
        </Reveal>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r, i) => (
            <Reveal key={r.role} delay={i * 0.06} className="bg-card rounded-2xl border p-6">
              <r.icon className="text-primary size-6" />
              <h3 className="mt-4 font-semibold">{r.role}</h3>
              <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
                {r.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="bg-primary mt-2 size-1 shrink-0 rounded-full" />
                    {p}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- Security ---------- */}
      <section id="security" className="bg-muted/40 scroll-mt-16 border-y">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
          <Reveal className="space-y-4">
            <p className="text-primary text-xs font-semibold tracking-widest uppercase">Security & compliance</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Built for sensitive health data</h2>
            <p className="text-muted-foreground">
              Identity is handled by a dedicated OpenID Connect provider. Each request is authenticated, authorised and audited, with defence in depth from the browser to the database.
            </p>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2">
            {SECURITY.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.06} className="bg-card rounded-2xl border p-6">
                <s.icon className="text-primary size-5" />
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{s.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <Reveal className="from-primary relative overflow-hidden rounded-3xl bg-gradient-to-br to-sky-700 px-8 py-16 text-center text-white shadow-xl sm:px-16">
          <div className="bg-grid absolute inset-0 opacity-20" />
          <div className="relative mx-auto max-w-2xl space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Ready when every minute matters</h2>
            <p className="text-white/80">Create a patient account in seconds, or sign in with the account your organisation gave you.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="secondary">
                <Link href="/login?mode=register">
                  Get started <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
                <Link href="/about">Learn more</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
