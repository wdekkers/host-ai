import { withPermission } from '@/lib/auth/authorize';

import { handleOverridePropertyKnowledgeEntry } from '../../../../../knowledge/handler';

type Params = { params: Promise<{ id: string; entryId: string }> };

export const POST = withPermission(
  'ops.write',
  async (request: Request, context, authContext) =>
    handleOverridePropertyKnowledgeEntry(request, context as Params, authContext),
);
