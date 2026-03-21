import { withPermission } from '@/lib/auth/authorize';
import { handleListTaskSuggestions } from './handler';

export const GET = withPermission('tasks.read', async (request: Request, _context, auth) =>
  handleListTaskSuggestions(request, auth),
);
