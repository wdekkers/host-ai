import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  const host = request.headers.get('host') ?? '';
  const domain = host.split(':')[0] ?? '';
  response.headers.set('x-site-domain', domain);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
