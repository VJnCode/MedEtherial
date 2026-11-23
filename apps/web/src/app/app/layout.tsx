import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.error) redirect('/signin?callbackUrl=/app');
  return <AppShell>{children}</AppShell>;
}
