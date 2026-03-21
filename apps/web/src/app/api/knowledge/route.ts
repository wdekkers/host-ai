import { withPermission } from '@/lib/auth/authorize';
import { handleCreateKnowledgeEntry, handleListKnowledgeEntries } from './handler';

export const GET = withPermission('properties.read', async (request: Request, _context, auth) =>
  handleListKnowledgeEntries(request, auth),
);

export const POST = withPermission('properties.update', async (request: Request, _context, auth) =>
  handleCreateKnowledgeEntry(request, auth),
);
