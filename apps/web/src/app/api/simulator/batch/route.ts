import { withPermission } from '@/lib/auth/authorize';
import { handleBatch } from './handler';

export const POST = withPermission('settings.update', async (request, _context, authContext) => {
  return handleBatch(request, authContext);
});
