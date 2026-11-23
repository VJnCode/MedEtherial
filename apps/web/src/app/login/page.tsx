import { redirect } from 'next/navigation';

/** Old URL kept for bookmarks and Auth.js error redirects: /login → /signin, /login?mode=register → /signup. */
export default async function LegacyLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { mode, ...rest } = await searchParams;
  const qs = new URLSearchParams(Object.entries(rest).filter((e): e is [string, string] => typeof e[1] === 'string')).toString();
  redirect(`${mode === 'register' ? '/signup' : '/signin'}${qs ? `?${qs}` : ''}`);
}
