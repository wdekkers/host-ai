import { withPermission } from '@/lib/auth/authorize';
import { handleGenerateFaqDraft } from './handler';

export const POST = withPermission('ops.write', async (request: Request) =>
  handleGenerateFaqDraft(request),
);
