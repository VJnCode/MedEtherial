import Link from 'next/link';
import { Logo } from '@/components/brand';

const COLUMNS = [
  {
    title: 'Platform',
    links: [
      { href: '/#features', label: 'Care coordination' },
      { href: '/#emergency', label: 'Ambulance tracking' },
      { href: '/#roles', label: 'Role-based workspaces' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/#security', label: 'Security' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/terms', label: 'Terms of service' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="text-muted-foreground max-w-xs text-sm">
            Connected care and emergency response — from the first symptom to the hospital bed.
          </p>
          <p className="text-muted-foreground text-xs">In a life-threatening emergency, always call your local emergency number.</p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title} className="space-y-3">
            <p className="text-sm font-semibold">{c.title}</p>
            <ul className="space-y-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} MedEtherial. All rights reserved.</p>
          <p>Map data © OpenStreetMap contributors · Routing by OSRM</p>
        </div>
      </div>
    </footer>
  );
}
