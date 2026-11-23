import { hasPermission } from '@medetherial/shared';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { requiredPermissionsFor } from '@/lib/nav';

/**
 * Edge guard for the authenticated app. The API re-checks every permission —
 * this layer just keeps users out of screens they cannot use.
 */
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const session = req.auth;

  if (pathname.startsWith('/app')) {
    if (!session || session.error === 'RefreshTokenError') {
      const url = new URL('/signin', req.nextUrl.origin);
      url.searchParams.set('callbackUrl', pathname + search);
      return NextResponse.redirect(url);
    }
    const required = requiredPermissionsFor(pathname);
    if (required && !required.some((p) => hasPermission(session.roles ?? [], p))) {
      const url = new URL('/app', req.nextUrl.origin);
      url.searchParams.set('denied', pathname);
      return NextResponse.redirect(url);
    }
  }

  if (['/signin', '/signup', '/login'].includes(pathname) && session && !session.error) {
    return NextResponse.redirect(new URL('/app', req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/app/:path*', '/signin', '/signup', '/login'],
};
