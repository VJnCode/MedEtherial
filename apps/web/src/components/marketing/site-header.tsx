'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Logo, ThemeToggle } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/overlay';

const LINKS = [
  { href: '/#features', label: 'Platform' },
  { href: '/#emergency', label: 'Emergency response' },
  { href: '/#roles', label: 'For teams' },
  { href: '/#security', label: 'Security' },
  { href: '/about', label: 'About' },
];

export function SiteHeader() {
  const { status } = useSession();
  const { scrollY } = useScroll();
  const borderOpacity = useTransform(scrollY, [0, 80], [0, 1]);

  const cta =
    status === 'authenticated' ? (
      <Button asChild size="sm">
        <Link href="/app">Open dashboard</Link>
      </Button>
    ) : (
      <>
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/login?mode=register">Get started</Link>
        </Button>
      </>
    );

  return (
    <header className="bg-background/75 sticky top-0 z-40 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {cta}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-6">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Logo />
              <nav className="mt-8 flex flex-col gap-1">
                {LINKS.map((l) => (
                  <Link key={l.href} href={l.href} className="hover:bg-accent rounded-md px-3 py-2.5 text-sm font-medium">
                    {l.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <motion.div style={{ opacity: borderOpacity }} className="bg-border h-px w-full" />
    </header>
  );
}
