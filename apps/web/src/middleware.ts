import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { getPermissionForApiRoute, hasPermission, resolveRoleFromClaims } from '@/lib/auth/permissions';

const isPublicRoute = createRouteMatcher(['/sign-in(.*)']);

export default clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname;

  if (isPublicRoute(request) || (pathname === '/api/integrations/hospitable' && request.method === 'POST')) {
    return NextResponse.next();
  }

  const session = await auth();
  if (!session.userId) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect_url', request.url);
    return NextResponse.redirect(signInUrl);
  }

  if (pathname.startsWith('/api')) {
    const permission = getPermissionForApiRoute(pathname, request.method);
    if (permission) {
      const role = resolveRoleFromClaims(session.sessionClaims);
      if (!hasPermission(role, permission)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)']
};
