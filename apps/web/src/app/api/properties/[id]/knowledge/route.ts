import { withPermission } from '@/lib/auth/authorize';

import {
  handleCreatePropertyKnowledgeEntry,
  handleListPropertyKnowledgeEntries,
} from '../../../knowledge/handler';

type Params = { params: Promise<{ id: string }> };

export const GET = withPermission(
  'properties.read',
  async (request: Request, context, authContext) =>
    handleListPropertyKnowledgeEntries(request, context as Params, authContext),
);

export const POST = withPermission(
  'properties.update',
  async (request: Request, context, authContext) =>
    handleCreatePropertyKnowledgeEntry(request, context as Params, authContext),
);
