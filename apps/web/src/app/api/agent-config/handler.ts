import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { type AuthContext } from '@walt/contracts';
import { agentConfigs } from '@walt/db';

type AgentConfigRow = typeof agentConfigs.$inferSelect;
type AgentConfigInput = {
  tone?: string | null;
  emojiUse?: string | null;
  responseLength?: string | null;
  escalationRules?: string | null;
  specialInstructions?: string | null;
};

type AgentConfigDependencies = {
  queryConfig?: (orgId: string) => Promise<AgentConfigRow | null>;
  upsertConfig?: (args: { orgId: string; values: AgentConfigInput }) => Promise<AgentConfigRow>;
};

async function queryGlobalAgentConfig(orgId: string): Promise<AgentConfigRow | null> {
  const [config] = await db
    .select()
    .from(agentConfigs)
    .where(and(eq(agentConfigs.organizationId, orgId), eq(agentConfigs.scope, 'global')))
    .limit(1);
  return config ?? null;
}

async function upsertGlobalAgentConfig({
  orgId,
  values,
}: {
  orgId: string;
  values: AgentConfigInput;
}): Promise<AgentConfigRow> {
  const [existing] = await db
    .select({ id: agentConfigs.id })
    .from(agentConfigs)
    .where(and(eq(agentConfigs.organizationId, orgId), eq(agentConfigs.scope, 'global')))
    .limit(1);

  const now = new Date();
  if (existing) {
    const [updated] = await db
      .update(agentConfigs)
      .set({ ...values, updatedAt: now })
      .where(eq(agentConfigs.id, existing.id))
      .returning();
    if (!updated) {
      throw new Error('Failed to update agent config');
    }
    return updated;
  }

  const [created] = await db
    .insert(agentConfigs)
    .values({
      id: uuidv4(),
      organizationId: orgId,
      scope: 'global',
      propertyId: null,
      ...values,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!created) {
    throw new Error('Failed to create agent config');
  }
  return created;
}

export async function handleGetAgentConfig(
  _request: Request,
  authContext: Pick<AuthContext, 'orgId'>,
  { queryConfig = queryGlobalAgentConfig }: AgentConfigDependencies = {},
) {
  try {
    const config = await queryConfig(authContext.orgId);
    return NextResponse.json({ config: config ?? null });
  } catch (error) {
    return handleApiError({ error, route: '/api/agent-config GET' });
  }
}

export async function handlePutAgentConfig(
  request: Request,
  authContext: Pick<AuthContext, 'orgId'>,
  { upsertConfig = upsertGlobalAgentConfig }: AgentConfigDependencies = {},
) {
  try {
    const { tone, emojiUse, responseLength, escalationRules, specialInstructions } =
      (await request.json()) as AgentConfigInput;
    const config = await upsertConfig({
      orgId: authContext.orgId,
      values: { tone, emojiUse, responseLength, escalationRules, specialInstructions },
    });
    return NextResponse.json({ config }, { status: 200 });
  } catch (error) {
    return handleApiError({ error, route: '/api/agent-config PUT' });
  }
}
