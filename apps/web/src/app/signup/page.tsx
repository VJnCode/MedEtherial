import type { Metadata } from 'next';
import { AuthScreen, type AuthSearchParams } from '@/components/auth/auth-screen';

export const metadata: Metadata = { title: 'Create account' };

export default function SignUpPage({ searchParams }: { searchParams: AuthSearchParams }) {
  return <AuthScreen mode="signup" searchParams={searchParams} />;
}
