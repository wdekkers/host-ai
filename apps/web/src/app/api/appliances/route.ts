import { withPermission } from '@/lib/auth/authorize';
import { handleList, handleCreate } from './handler';

export const GET = withPermission('appliances.read', async (request, _context, authContext) => {
  return handleList(request, authContext);
});

export const POST = withPermission('appliances.create', async (request, _context, authContext) => {
  return handleCreate(request, authContext);
});
