import { withPermission } from '@/lib/auth/authorize';

import { handlePatchPropertyKnowledgeEntry } from '../../../../knowledge/route';
export { handlePatchPropertyKnowledgeEntry } from '../../../../knowledge/route';

type Params = { params: Promise<{ id: string; entryId: string }> };

export const PATCH = withPermission(
  'ops.write',
  async (request: Request, context, authContext) =>
    handlePatchPropertyKnowledgeEntry(request, context as Params, authContext),
);
