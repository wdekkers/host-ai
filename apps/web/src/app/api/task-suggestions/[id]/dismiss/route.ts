import { withPermission } from '@/lib/auth/authorize';
import { handleDismissSuggestion } from './handler';

export const POST = withPermission(
  'ops.write',
  async (request, context: { params: Promise<{ id: string }> }, auth) =>
    handleDismissSuggestion(request, context, auth),
);
