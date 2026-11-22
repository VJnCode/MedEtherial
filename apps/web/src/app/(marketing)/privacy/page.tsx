import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy policy' };

const SECTIONS = [
  ['Data we process', 'Account identity (name, e-mail) from our identity provider, the health information you or your clinicians enter, appointment history, and location data while an emergency request is active or while a crew device shares its position.'],
  ['How we use it', 'To provide care coordination and emergency response, to route ambulances, to notify receiving hospitals, and to keep a legally required audit trail. We do not sell personal data.'],
  ['Location data', 'Patient location is captured only when you raise an emergency request. Ambulance GPS breadcrumbs are kept for seven days and then deleted automatically.'],
  ['Who can see your records', 'You, clinicians with an appointment or emergency link to you, the crew assigned to your emergency, and platform administrators. Every access is logged.'],
  ['Security', 'Authentication uses OpenID Connect with PKCE. Data travels over TLS. Access is enforced per request by role and by your relationship to the record.'],
  ['Your rights', 'You may request access to, correction of, or deletion of your data, subject to medical record-keeping obligations. Contact your MedEtherial administrator.'],
];

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10 px-4 py-20 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight">Privacy policy</h1>
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
