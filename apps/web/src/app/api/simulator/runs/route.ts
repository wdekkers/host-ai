import { withPermission } from '@/lib/auth/authorize';
import { handleListRuns } from './handler';

export const GET = withPermission('settings.read', async (request, _context, authContext) => {
  return handleListRuns(request, authContext);
});
