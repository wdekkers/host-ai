import { NextResponse } from 'next/server';
import { roleSchema } from '@walt/contracts';

import type { Permission } from '@walt/contracts';

import { requirePermission } from './authorize';
import { hasPermission } from './permissions';

export type Actor = { userId: string; orgId: string; role: string };

/**
 * Resolve the actor for a handler, with a test seam for DI.
 *
 * In production, delegates to `requirePermission(req, permission)` which enforces
 * Clerk auth + role→permission gating from `permissions.ts`.
 *
 * In tests, the `override` callback returns the actor directly. The same
 * permission gate is still applied via `hasPermission(role, permission)` so the
 * test path can't silently diverge from production if the permissions map
 * changes. Roles that aren't in the canonical `roleSchema` enum are rejected
 * with 403.
 *
 * Returns either an `Actor` (authorized) or a `Response` (401/403 to return to
 * the caller).
 */
export async function resolveActor(
  req: Request,
  permission: Permission,
  override?: (req: Request) => Promise<Actor | null>,
): Promise<Actor | Response> {
  if (override) {
    const actor = await override(req);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Narrow the actor role into the canonical `Role` enum, then use the
    // production permission check so tests can't drift from role gating.
    const role = roleSchema.safeParse(actor.role);
    if (!role.success || !hasPermission(role.data, permission)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return actor;
  }
  const ctx = await requirePermission(req, permission);
  if (ctx instanceof Response) {
    return ctx;
  }
  return { userId: ctx.userId, orgId: ctx.orgId, role: ctx.role };
}
