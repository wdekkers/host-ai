import { NextResponse } from 'next/server';
import { eq, and, desc, asc } from 'drizzle-orm';

import type { AuthContext } from '@walt/contracts';
import { db } from '@/lib/db';
import { simulatorRuns, simulatorResults } from '@walt/db';

export async function handleListRuns(request: Request, authContext: AuthContext) {
  const url = new URL(request.url);
  const propertyId = url.searchParams.get('propertyId');
  if (!propertyId) {
    return NextResponse.json({ error: 'propertyId required' }, { status: 400 });
  }

  const runs = await db
    .select()
    .from(simulatorRuns)
    .where(
      and(
        eq(simulatorRuns.organizationId, authContext.orgId),
        eq(simulatorRuns.propertyId, propertyId),
      ),
    )
    .orderBy(desc(simulatorRuns.createdAt));

  return NextResponse.json({ runs });
}

export async function handleGetRun(runId: string, authContext: AuthContext) {
  const [run] = await db
    .select()
    .from(simulatorRuns)
    .where(
      and(
        eq(simulatorRuns.id, runId),
        eq(simulatorRuns.organizationId, authContext.orgId),
      ),
    )
    .limit(1);

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const results = await db
    .select()
    .from(simulatorResults)
    .where(eq(simulatorResults.runId, runId))
    .orderBy(asc(simulatorResults.sortOrder));

  return NextResponse.json({ ...run, results });
}
