import { clerkClient, clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { getPermissionForApiRoute, hasPermission } from '@/lib/auth/permissions';
import { roleSchema } from '@walt/contracts';
import type { Role } from '@walt/contracts';

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/api/cron/(.*)']);

// Cache role lookups for 5 minutes to avoid Clerk Management API rate limits.
const roleCache = new Map<string, { role: Role; expiresAt: number }>();
const ROLE_CACHE_TTL_MS = 5 * 60 * 1000;

async function getUserRole(userId: string): Promise<Role> {
  const cached = roleCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.role;
  }
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const roleCandidate = (user.privateMetadata as Record<string, unknown>).role;
    const parsed = roleSchema.safeParse(roleCandidate);
    const role = parsed.success ? parsed.data : 'owner';
    roleCache.set(userId, { role, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
    return role;
  } catch {
    // Clerk Management API unavailable — allow authenticated users through as owner.
    // The role cache will not be populated, so this is re-attempted on the next request.
    return 'owner';
  }
}

export default clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname;

  if (
    isPublicRoute(request) ||
    (pathname === '/api/integrations/hospitable' && request.method === 'POST') ||
    (pathname === '/api/webhooks/twilio' && request.method === 'POST')
  ) {
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
      const role = await getUserRole(session.userId);
      if (!hasPermission(role, permission)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};
