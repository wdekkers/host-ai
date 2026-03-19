import { withPermission } from '@/lib/auth/authorize';
import { handleAcceptSuggestion } from './handler';

export const POST = withPermission(
  'ops.write',
  async (request, context: { params: Promise<{ id: string }> }, auth) =>
    handleAcceptSuggestion(request, context, auth),
);
