import { withPermission } from '@/lib/auth/authorize';

import { handleDeleteScoringRule, handlePatchScoringRule } from './handler';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withPermission('properties.update', async (req, ctx: Ctx, auth) => {
  const params = await ctx.params;
  return handlePatchScoringRule(req, params, { orgId: auth.orgId });
});

export const DELETE = withPermission('properties.update', async (_req, ctx: Ctx, auth) => {
  const params = await ctx.params;
  return handleDeleteScoringRule(params, { orgId: auth.orgId });
});
