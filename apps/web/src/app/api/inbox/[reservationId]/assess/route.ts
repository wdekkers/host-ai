import { withPermission } from '@/lib/auth/authorize';

import { handleAssess } from './handler';

type Ctx = { params: Promise<{ reservationId: string }> };

export const POST = withPermission('inbox.read', async (req, ctx: Ctx, auth) => {
  const { reservationId } = await ctx.params;
  return handleAssess(req, reservationId, { orgId: auth.orgId, userId: auth.userId });
});
