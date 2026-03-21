import { withPermission } from '@/lib/auth/authorize';
import { handleAcceptSuggestion } from './handler';

export const POST = withPermission(
  'tasks.update',
  async (request, context: { params: Promise<{ id: string }> }, auth) =>
    handleAcceptSuggestion(request, context, auth),
);
