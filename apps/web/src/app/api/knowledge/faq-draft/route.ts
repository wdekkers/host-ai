import { withPermission } from '@/lib/auth/authorize';
import { handleGenerateFaqDraft } from './handler';

export const POST = withPermission('properties.update', async (request: Request) =>
  handleGenerateFaqDraft(request),
);
