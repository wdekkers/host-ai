import { withPermission } from '@/lib/auth/authorize';
import { handleRunSeoDrafts } from './run-handler';

export const POST = withPermission('drafts.write', async (request: Request, _context, auth) =>
  handleRunSeoDrafts(request, auth),
);
