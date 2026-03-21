import { withPermission } from '@/lib/auth/authorize';

import { handlePatchKnowledgeEntry } from '../handler';

type Params = { params: Promise<{ id: string }> };

export const PATCH = withPermission(
  'properties.update',
  async (request: Request, context, authContext) =>
    handlePatchKnowledgeEntry(request, context as Params, authContext),
);
