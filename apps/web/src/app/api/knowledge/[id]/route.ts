import { withPermission } from '@/lib/auth/authorize';

import {
  handlePatchKnowledgeEntry,
} from '../route';

type Params = { params: Promise<{ id: string }> };

export const PATCH = withPermission(
  'ops.write',
  async (request: Request, context, authContext) =>
    handlePatchKnowledgeEntry(request, context as Params, authContext),
);
