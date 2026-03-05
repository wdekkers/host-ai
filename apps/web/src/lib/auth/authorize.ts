import { NextResponse } from 'next/server';

import { getAuthContext } from './get-auth-context';
import { hasPermission } from './permissions';

import type { AuthContext, Permission } from '@walt/contracts';

type RouteHandler<TContext> = (request: Request, context: TContext, authContext: AuthContext) => Promise<Response>;

export async function requireAuth(request: Request): Promise<AuthContext | Response> {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return authContext;
}

export async function requirePermission(request: Request, permission: Permission): Promise<AuthContext | Response> {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(authContext.role, permission)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return authContext;
}

export function withPermission<TContext>(permission: Permission, handler: RouteHandler<TContext>) {
  return async (request: Request, context: TContext) => {
    const maybeAuthContext = await requirePermission(request, permission);
    if (maybeAuthContext instanceof Response) {
      return maybeAuthContext;
    }
    return handler(request, context, maybeAuthContext);
  };
}

export function withAuth<TContext>(handler: RouteHandler<TContext>) {
  return async (request: Request, context: TContext) => {
    const maybeAuthContext = await requireAuth(request);
    if (maybeAuthContext instanceof Response) {
      return maybeAuthContext;
    }
    return handler(request, context, maybeAuthContext);
  };
}
