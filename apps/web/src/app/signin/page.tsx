import type { Metadata } from 'next';
import { AuthScreen, type AuthSearchParams } from '@/components/auth/auth-screen';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage({ searchParams }: { searchParams: AuthSearchParams }) {
  return <AuthScreen mode="signin" searchParams={searchParams} />;
}
