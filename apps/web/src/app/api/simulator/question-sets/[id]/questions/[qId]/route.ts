import { withPermission } from '@/lib/auth/authorize';
import { handleUpdateQuestion, handleDeleteQuestion } from '../../../handler';

type Params = { params: Promise<{ id: string; qId: string }> };

export const PATCH = withPermission('settings.update', async (request, context: Params) => {
  const { qId } = await context.params;
  return handleUpdateQuestion(request, qId);
});

export const DELETE = withPermission('settings.update', async (_request, context: Params) => {
  const { qId } = await context.params;
  return handleDeleteQuestion(qId);
});
