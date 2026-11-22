import type { Metadata } from 'next';
import { Reveal } from '@/components/marketing/reveal';

export const metadata: Metadata = { title: 'About' };

const PRINCIPLES = [
  ['Minutes matter', 'Every screen in an emergency flow is designed to remove a decision, a click or a phone call.'],
  ['Least privilege', 'People see exactly what their role and relationship to the patient allow, and nothing more.'],
  ['Open foundations', 'Standards-based identity (OIDC), open map data (OpenStreetMap) and open-source routing (OSRM).'],
  ['Accountability', 'Every access to health data leaves an immutable trace.'],
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-20 sm:px-6">
      <Reveal className="space-y-4">
        <p className="text-primary text-xs font-semibold tracking-widest uppercase">About MedEtherial</p>
        <h1 className="text-4xl font-semibold tracking-tight">Connecting routine care and emergency response</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Healthcare often breaks down in the gaps: between a patient and a clinic, a caller and a dispatcher, an ambulance and an emergency room.
          MedEtherial closes those gaps with one platform that every role in the chain of care shares.
        </p>
      </Reveal>
      <div className="grid gap-6 sm:grid-cols-2">
        {PRINCIPLES.map(([t, b], i) => (
          <Reveal key={t} delay={i * 0.05} className="bg-card rounded-2xl border p-6">
            <h2 className="font-semibold">{t}</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{b}</p>
          </Reveal>
        ))}
      </div>
      <Reveal className="text-muted-foreground border-l-primary rounded-r-xl border-l-4 bg-muted/40 p-6 text-sm">
        MedEtherial supports clinical and emergency workflows, but it does not replace public emergency services. In a life-threatening situation, always call your local
        emergency number first.
      </Reveal>
    </div>
  );
}
