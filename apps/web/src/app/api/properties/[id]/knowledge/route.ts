import { withPermission } from '@/lib/auth/authorize';

import {
  handleCreatePropertyKnowledgeEntry,
  handleListPropertyKnowledgeEntries,
} from '../../../knowledge/route';
export {
  handleCreatePropertyKnowledgeEntry,
  handleListPropertyKnowledgeEntries,
} from '../../../knowledge/route';

type Params = { params: Promise<{ id: string }> };

export const GET = withPermission(
  'dashboard.read',
  async (request: Request, context, authContext) =>
    handleListPropertyKnowledgeEntries(request, context as Params, authContext),
);

export const POST = withPermission(
  'ops.write',
  async (request: Request, context, authContext) =>
    handleCreatePropertyKnowledgeEntry(request, context as Params, authContext),
);
