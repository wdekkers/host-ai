import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { agentConfigs } from '@walt/db';

export const GET = withPermission('dashboard.read', async (_req: Request, _p, authContext) => {
  try {
    const organizationId = authContext.orgId;
    const [config] = await db
      .select()
      .from(agentConfigs)
      .where(and(eq(agentConfigs.organizationId, organizationId), eq(agentConfigs.scope, 'global')))
      .limit(1);
    return NextResponse.json({ config: config ?? null });
  } catch (error) {
    return handleApiError({ error, route: '/api/agent-config GET' });
  }
});

export const PUT = withPermission('ops.write', async (request: Request, _p, authContext) => {
  try {
    const organizationId = authContext.orgId;
    const body = (await request.json()) as {
      tone?: string;
      emojiUse?: string;
      responseLength?: string;
      escalationRules?: string;
      specialInstructions?: string;
    };

    const [existing] = await db
      .select({ id: agentConfigs.id })
      .from(agentConfigs)
      .where(and(eq(agentConfigs.organizationId, organizationId), eq(agentConfigs.scope, 'global')))
      .limit(1);

    const now = new Date();
    if (existing) {
      const [updated] = await db
        .update(agentConfigs)
        .set({ ...body, updatedAt: now })
        .where(eq(agentConfigs.id, existing.id))
        .returning();
      return NextResponse.json({ config: updated });
    } else {
      const [created] = await db
        .insert(agentConfigs)
        .values({
          id: uuidv4(),
          organizationId,
          scope: 'global',
          ...body,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return NextResponse.json({ config: created }, { status: 201 });
    }
  } catch (error) {
    return handleApiError({ error, route: '/api/agent-config PUT' });
  }
});
