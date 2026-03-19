import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { taskSuggestions } from '@walt/db';
import type { AuthContext } from '@walt/contracts';

type Deps = {
  markDismissed?: (id: string, orgId: string) => Promise<void>;
};

async function defaultMarkDismissed(id: string, orgId: string) {
  const { db } = await import('@/lib/db');
  await db
    .update(taskSuggestions)
    .set({ status: 'dismissed' })
    .where(and(eq(taskSuggestions.id, id), eq(taskSuggestions.organizationId, orgId)));
}

export async function handleDismissSuggestion(
  _request: Request,
  context: { params: Promise<{ id: string }> },
  auth: AuthContext,
  deps: Deps = {},
) {
  const { id } = await context.params;
  const markDismissed = deps.markDismissed ?? defaultMarkDismissed;
  await markDismissed(id, auth.orgId);
  return NextResponse.json({ ok: true });
}
