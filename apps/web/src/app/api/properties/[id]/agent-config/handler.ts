import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { agentConfigs } from '@walt/db';

type Params = { params: Promise<{ id: string }> };

type AgentConfigRow = typeof agentConfigs.$inferSelect;
type AgentConfigInput = {
  tone?: string | null;
  emojiUse?: string | null;
  responseLength?: string | null;
  escalationRules?: string | null;
  specialInstructions?: string | null;
};

type AgentConfigDependencies = {
  queryConfig?: (orgId: string, propertyId: string) => Promise<AgentConfigRow | null>;
  upsertConfig?: (args: {
    orgId: string;
    propertyId: string;
    values: AgentConfigInput;
  }) => Promise<AgentConfigRow>;
};

async function queryPropertyAgentConfig(
  orgId: string,
  propertyId: string,
): Promise<AgentConfigRow | null> {
  const [config] = await db
    .select()
    .from(agentConfigs)
    .where(
      and(
        eq(agentConfigs.organizationId, orgId),
        eq(agentConfigs.scope, 'property'),
        eq(agentConfigs.propertyId, propertyId),
      ),
    )
    .limit(1);
  return config ?? null;
}

async function upsertPropertyAgentConfig({
  orgId,
  propertyId,
  values,
}: {
  orgId: string;
  propertyId: string;
  values: AgentConfigInput;
}): Promise<AgentConfigRow> {
  const [existing] = await db
    .select({ id: agentConfigs.id })
    .from(agentConfigs)
    .where(
      and(
        eq(agentConfigs.organizationId, orgId),
        eq(agentConfigs.scope, 'property'),
        eq(agentConfigs.propertyId, propertyId),
      ),
    )
    .limit(1);

  const now = new Date();
  if (existing) {
    const [updated] = await db
      .update(agentConfigs)
      .set({ ...values, updatedAt: now })
      .where(eq(agentConfigs.id, existing.id))
      .returning();
    if (!updated) {
      throw new Error('Failed to update property agent config');
    }
    return updated;
  }

  const [created] = await db
    .insert(agentConfigs)
    .values({
      id: uuidv4(),
      organizationId: orgId,
      scope: 'property',
      propertyId,
      ...values,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!created) {
    throw new Error('Failed to create property agent config');
  }
  return created;
}

export async function handleGetPropertyAgentConfig(
  _request: Request,
  { params }: Params,
  authContext: { orgId: string },
  { queryConfig = queryPropertyAgentConfig }: AgentConfigDependencies = {},
) {
  try {
    const { id: propertyId } = await params;
    const config = await queryConfig(authContext.orgId, propertyId);
    return NextResponse.json({ config: config ?? null });
  } catch (error) {
    return handleApiError({ error, route: '/api/properties/[id]/agent-config GET' });
  }
}

export async function handlePutPropertyAgentConfig(
  request: Request,
  { params }: Params,
  authContext: { orgId: string },
  { upsertConfig = upsertPropertyAgentConfig }: AgentConfigDependencies = {},
) {
  try {
    const { id: propertyId } = await params;
    const { tone, emojiUse, responseLength, escalationRules, specialInstructions } =
      (await request.json()) as AgentConfigInput;
    const config = await upsertConfig({
      orgId: authContext.orgId,
      propertyId,
      values: { tone, emojiUse, responseLength, escalationRules, specialInstructions },
    });
    return NextResponse.json({ config }, { status: 200 });
  } catch (error) {
    return handleApiError({ error, route: '/api/properties/[id]/agent-config PUT' });
  }
}
