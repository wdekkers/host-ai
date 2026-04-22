import { withPermission } from '@/lib/auth/authorize';

import { handleFeedback } from './handler';

type Ctx = { params: Promise<{ reservationId: string }> };

export const POST = withPermission('properties.update', async (req, ctx: Ctx, auth) => {
  const { reservationId } = await ctx.params;
  return handleFeedback(req, reservationId, { orgId: auth.orgId, userId: auth.userId });
});
