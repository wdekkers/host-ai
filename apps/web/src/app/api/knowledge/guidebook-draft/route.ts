import { withPermission } from '@/lib/auth/authorize';
import { handleGenerateGuidebookDraft } from './handler';

export const POST = withPermission('ops.write', async (request: Request) =>
  handleGenerateGuidebookDraft(request),
);
