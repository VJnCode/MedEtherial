import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of service' };

const SECTIONS = [
  ['Not a substitute for emergency services', 'MedEtherial coordinates care and ambulance response but does not guarantee availability of units or beds. In a life-threatening emergency, call your local emergency number.'],
  ['Accounts', 'You are responsible for keeping your credentials secure. Role assignments are managed by your organisation’s administrators.'],
  ['Acceptable use', 'Do not raise false emergency requests, attempt to access records you are not entitled to, or interfere with the service. Misuse is logged and may be reported.'],
  ['Clinical responsibility', 'Clinical decisions remain the responsibility of licensed professionals. Automated triage is a decision-support aid, not a diagnosis.'],
  ['Changes', 'We may update these terms. Continued use after changes means you accept the updated terms.'],
];

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10 px-4 py-20 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight">Terms of service</h1>
        <p className="text-muted-foreground text-sm">Last updated {new Date().getFullYear()}</p>
      </header>
      {SECTIONS.map(([t, b]) => (
        <section key={t} className="space-y-2">
          <h2 className="text-lg font-semibold">{t}</h2>
          <p className="text-muted-foreground leading-relaxed">{b}</p>
        </section>
      ))}
    </article>
  );
}
