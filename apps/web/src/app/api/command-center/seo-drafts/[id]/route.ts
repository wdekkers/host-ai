import { withPermission } from '@/lib/auth/authorize';
import { handlePatchSeoDraft } from './patch-handler';

type Params = { params: Promise<{ id: string }> };

export const PATCH = withPermission(
  'seo.update',
  async (request: Request, { params }: Params, auth) => {
    const { id } = await params;
    return handlePatchSeoDraft(request, { id }, auth);
  },
);
