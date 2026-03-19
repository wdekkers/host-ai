import { desc, eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { taskSuggestions } from '@walt/db';
import type { AuthContext } from '@walt/contracts';

type ListDeps = {
  querySuggestions?: (args: { orgId: string; status: string }) => Promise<unknown[]>;
};

async function defaultQuerySuggestions({ orgId, status }: { orgId: string; status: string }) {
  const { db } = await import('@/lib/db');
  return db
    .select()
    .from(taskSuggestions)
    .where(
      and(
        eq(taskSuggestions.organizationId, orgId),
        eq(taskSuggestions.status, status),
      ),
    )
    .orderBy(desc(taskSuggestions.createdAt));
}

export async function handleListTaskSuggestions(
  request: Request,
  auth: AuthContext,
  deps: ListDeps = {},
) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'pending';
  const querySuggestions = deps.querySuggestions ?? defaultQuerySuggestions;
  const rows = await querySuggestions({ orgId: auth.orgId, status });
  return NextResponse.json({ suggestions: rows });
}
