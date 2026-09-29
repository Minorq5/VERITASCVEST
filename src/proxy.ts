import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { isProtectedPath } from './lib/config/routes';
import { hasSessionCookie } from './lib/supabase/cookies';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);
const LOCALE_PATH = new RegExp(`^/(${routing.locales.join('|')})(/.*)?$`);

export default function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(LOCALE_PATH);
  if (match) {
    const locale = match[1]!;
    const rest = match[2] ?? '/';
    // A missing session cookie is a certain "signed out"; anything else is
    // verified by the page itself (and by RLS in the database).
    if (isProtectedPath(rest) && !hasSessionCookie(request.cookies.getAll().map((c) => c.name))) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/login`;
      url.search = `?next=${encodeURIComponent(rest + request.nextUrl.search)}`;
      return NextResponse.redirect(url);
    }
  }
  return intl(request);
}

export const config = {
  // Everything except API routes, Next.js internals and files with an extension.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
