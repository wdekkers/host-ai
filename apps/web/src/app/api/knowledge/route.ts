import { withPermission } from '@/lib/auth/authorize';
import { handleCreateKnowledgeEntry, handleListKnowledgeEntries } from './handler';

export const GET = withPermission('dashboard.read', async (request: Request, _context, auth) =>
  handleListKnowledgeEntries(request, auth),
);

export const POST = withPermission('ops.write', async (request: Request, _context, auth) =>
  handleCreateKnowledgeEntry(request, auth),
);
