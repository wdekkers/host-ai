import { withPermission } from '@/lib/auth/authorize';
import { handleListAssessments } from './handler';

type Ctx = { params: Promise<{ reservationId: string }> };

export const GET = withPermission('inbox.read', async (_req, ctx: Ctx) => {
  const { reservationId } = await ctx.params;
  return handleListAssessments(reservationId);
});
