import { withPermission } from '@/lib/auth/authorize';
import { handleDismissSuggestion } from './handler';

export const POST = withPermission(
  'tasks.update',
  async (request, context: { params: Promise<{ id: string }> }, auth) =>
    handleDismissSuggestion(request, context, auth),
);
