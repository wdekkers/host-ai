import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { scoringRules } from '@walt/db';

import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';

const patchBodySchema = z.object({
  ruleText: z.string().trim().min(1).max(500).optional(),
  active: z.boolean().optional(),
});

export async function handlePatchScoringRule(
  request: Request,
  params: { id: string },
  auth: { orgId: string },
): Promise<Response> {
  try {
    const parsed = patchBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const [row] = await db
      .update(scoringRules)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(scoringRules.id, params.id), eq(scoringRules.organizationId, auth.orgId)))
      .returning();
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ item: row });
  } catch (error) {
    return handleApiError({ error, route: '/api/scoring-rules/[id] PATCH' });
  }
}

export async function handleDeleteScoringRule(
  params: { id: string },
  auth: { orgId: string },
): Promise<Response> {
  try {
    const [row] = await db
      .delete(scoringRules)
      .where(and(eq(scoringRules.id, params.id), eq(scoringRules.organizationId, auth.orgId)))
      .returning({ id: scoringRules.id });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError({ error, route: '/api/scoring-rules/[id] DELETE' });
  }
}
