import { withPermission } from '@/lib/auth/authorize';
import { handleChat } from './handler';

export const POST = withPermission('settings.update', async (request, _context, authContext) => {
  return handleChat(request, authContext);
});
