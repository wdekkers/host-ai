import { withPermission } from '@/lib/auth/authorize';
import { handleListSets, handleCreateSet } from './handler';

export const GET = withPermission('settings.read', async (request, _context, authContext) => {
  return handleListSets(request, authContext);
});

export const POST = withPermission('settings.update', async (request, _context, authContext) => {
  return handleCreateSet(request, authContext);
});
