import { withPermission } from '@/lib/auth/authorize';
import { handleAddQuestion } from '../../handler';

type Params = { params: Promise<{ id: string }> };

export const POST = withPermission('settings.update', async (request, context: Params, authContext) => {
  const { id } = await context.params;
  return handleAddQuestion(request, id, authContext);
});
