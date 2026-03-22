import { withPermission } from '@/lib/auth/authorize';
import { handleGetRun } from '../handler';

type Params = { params: Promise<{ runId: string }> };

export const GET = withPermission('settings.read', async (_request, context: Params, authContext) => {
  const { runId } = await context.params;
  return handleGetRun(runId, authContext);
});
