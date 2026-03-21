import { withPermission } from '@/lib/auth/authorize';
import { handleGenerateGuidebookDraft } from './handler';

export const POST = withPermission('properties.update', async (request: Request) =>
  handleGenerateGuidebookDraft(request),
);
