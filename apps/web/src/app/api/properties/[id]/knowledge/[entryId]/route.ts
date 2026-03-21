import { withPermission } from '@/lib/auth/authorize';

import { handlePatchPropertyKnowledgeEntry } from '../../../../knowledge/handler';

type Params = { params: Promise<{ id: string; entryId: string }> };

export const PATCH = withPermission(
  'properties.update',
  async (request: Request, context, authContext) =>
    handlePatchPropertyKnowledgeEntry(request, context as Params, authContext),
);
