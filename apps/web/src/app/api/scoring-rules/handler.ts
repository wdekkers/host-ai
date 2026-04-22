import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { scoringRules } from '@walt/db';

import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';

const createBodySchema = z.object({
  ruleText: z.string().trim().min(1, 'Rule text required').max(500),
});

type ScoringRuleRow = typeof scoringRules.$inferSelect;

type Deps = {
  listRules?: (orgId: string) => Promise<ScoringRuleRow[]>;
  createRule?: (args: {
    orgId: string;
    userId: string;
    ruleText: string;
  }) => Promise<ScoringRuleRow>;
};

async function defaultListRules(orgId: string): Promise<ScoringRuleRow[]> {
  return db
    .select()
    .from(scoringRules)
    .where(eq(scoringRules.organizationId, orgId))
    .orderBy(desc(scoringRules.createdAt));
}

async function defaultCreateRule(args: {
  orgId: string;
  userId: string;
  ruleText: string;
}): Promise<ScoringRuleRow> {
  const [row] = await db
    .insert(scoringRules)
    .values({
      id: uuidv4(),
      organizationId: args.orgId,
      ruleText: args.ruleText,
      active: true,
      createdBy: args.userId,
    })
    .returning();
  if (!row) throw new Error('Failed to create scoring rule');
  return row;
}

export async function handleListScoringRules(
  auth: { orgId: string },
  deps: Deps = {},
): Promise<Response> {
  try {
    const listRules = deps.listRules ?? defaultListRules;
    const items = await listRules(auth.orgId);
    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError({ error, route: '/api/scoring-rules GET' });
  }
}

export async function handleCreateScoringRule(
  request: Request,
  auth: { orgId: string; userId: string },
  deps: Deps = {},
): Promise<Response> {
  try {
    const body = await request.json();
    const parsed = createBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const createRule = deps.createRule ?? defaultCreateRule;
    const item = await createRule({
      orgId: auth.orgId,
      userId: auth.userId,
      ruleText: parsed.data.ruleText,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return handleApiError({ error, route: '/api/scoring-rules POST' });
  }
}
