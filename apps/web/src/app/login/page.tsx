import { ArrowLeft, KeyRound, ShieldCheck, UserPlus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { signIn } from '@/auth';
import { LogoMark, ThemeToggle } from '@/components/brand';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Sign in' };

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_SIGNIN !== 'false';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.77-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.11C6.23 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  );
}

const DEMO = [
  ['patient@medetherial.dev', 'Patient'],
  ['dr.rao@medetherial.dev', 'Doctor'],
  ['paramedic@medetherial.dev', 'Paramedic'],
  ['dispatch@medetherial.dev', 'Dispatcher'],
  ['hospital@medetherial.dev', 'Hospital admin'],
  ['admin@medetherial.dev', 'Administrator'],
];

const ERRORS: Record<string, string> = {
  OAuthCallbackError: 'The sign-in was cancelled or could not be completed.',
  Configuration: 'Authentication is not configured correctly. Please contact support.',
  AccessDenied: 'Access was denied by the identity provider.',
};

/** Only allow same-site relative redirects (prevents open redirects). */
function safeCallback(url?: string) {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/app';
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const callbackUrl = safeCallback(params.callbackUrl);
  const register = params.mode === 'register';
  const error = params.error ? (ERRORS[params.error] ?? 'Sign-in failed. Please try again.') : null;

  async function login() {
    'use server';
    await signIn('keycloak', { redirectTo: callbackUrl });
  }
  async function signup() {
    'use server';
    // OIDC `prompt=create` opens Keycloak's registration screen.
    await signIn('keycloak', { redirectTo: callbackUrl }, { prompt: 'create' });
  }
  async function google() {
    'use server';
    // `kc_idp_hint` makes Keycloak skip its own form and go straight to Google.
    // New Google users are created as patients; other roles are requested from the profile page.
    await signIn('keycloak', { redirectTo: callbackUrl }, { kc_idp_hint: 'google' });
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft /> Home
            </Link>
          </Button>
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 py-12">
          <div className="space-y-3">
            <LogoMark className="size-11" />
            <h1 className="text-3xl font-semibold tracking-tight">{register ? 'Create your account' : 'Welcome back'}</h1>
            <p className="text-muted-foreground text-sm">
              {register
                ? 'Anyone can join as a patient straight away. Doctors, crew and staff request their role after signing up, and an administrator approves it.'
                : 'Sign in securely with MedEtherial ID, our OpenID Connect single sign-on.'}
            </p>
          </div>

          {error && (
            <p role="alert" className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
              {error}
            </p>
          )}

          <div className="space-y-3">
            {GOOGLE_ENABLED && (
              <>
                <form action={google}>
                  <Button type="submit" size="lg" variant="outline" className="w-full" data-testid="sign-in-google">
                    <GoogleIcon />
                    {register ? 'Sign up with Google' : 'Continue with Google'}
                  </Button>
                </form>
                <div className="text-muted-foreground flex items-center gap-3 text-xs">
                  <span className="bg-border h-px flex-1" /> or <span className="bg-border h-px flex-1" />
                </div>
              </>
            )}
            <form action={register ? signup : login}>
              <Button type="submit" size="lg" className="w-full" data-testid="sign-in">
                {register ? <UserPlus /> : <KeyRound />}
                {register ? 'Sign up with MedEtherial ID' : 'Continue with MedEtherial ID'}
              </Button>
            </form>
            <p className="text-muted-foreground text-center text-sm">
              {register ? 'Already have an account? ' : 'New to MedEtherial? '}
              <Link href={register ? '/login' : '/login?mode=register'} className="text-primary font-medium hover:underline">
                {register ? 'Sign in' : 'Create an account'}
              </Link>
            </p>
          </div>

          {process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === 'true' && !register && (
            <div className="bg-muted/40 space-y-3 rounded-xl border p-4">
              <p className="text-xs font-semibold tracking-wide uppercase">Demo accounts</p>
              <ul className="space-y-1.5 text-xs">
                {DEMO.map(([email, role]) => (
                  <li key={email} className="flex items-center justify-between gap-2">
                    <code className="font-mono">{email}</code>
                    <span className="text-muted-foreground">{role}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground text-xs">Use the demo password your administrator configured.</p>
            </div>
          )}

          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <ShieldCheck className="text-success size-4" /> Authorization Code flow with PKCE. Your password never reaches this app.
          </p>
        </div>
      </div>

      <div className="from-primary relative hidden overflow-hidden bg-gradient-to-br via-teal-700 to-sky-800 lg:block">
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative flex h-full flex-col justify-end gap-6 p-14 text-white">
          <blockquote className="max-w-md space-y-4">
            <p className="text-2xl leading-snug font-medium">
              “From the moment the SOS comes in, the crew, the dispatcher and the ER all see the same picture. That’s what saves minutes.”
            </p>
            <footer className="text-sm text-white/70">Emergency medicine lead</footer>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
