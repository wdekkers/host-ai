import { withPermission } from '@/lib/auth/authorize';
import { handleRunSeoDrafts } from './run-handler';

export const POST = withPermission('seo.create', async (request: Request, _context, auth) =>
  handleRunSeoDrafts(request, auth),
);
