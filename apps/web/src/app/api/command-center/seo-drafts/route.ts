import { withPermission } from '@/lib/auth/authorize';
import { handleListSeoDrafts } from './list-handler';

export const GET = withPermission('dashboard.read', async (request: Request, _context, auth) =>
  handleListSeoDrafts(request, auth),
);
