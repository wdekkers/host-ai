import { withPermission } from '@/lib/auth/authorize';
import { handleGetSetWithQuestions, handleUpdateSet, handleDeleteSet } from '../handler';

type Params = { params: Promise<{ id: string }> };

export const GET = withPermission('settings.read', async (_request, context: Params, authContext) => {
  const { id } = await context.params;
  return handleGetSetWithQuestions(id, authContext);
});

export const PATCH = withPermission('settings.update', async (request, context: Params, authContext) => {
  const { id } = await context.params;
  return handleUpdateSet(request, id, authContext);
});

export const DELETE = withPermission('settings.update', async (_request, context: Params, authContext) => {
  const { id } = await context.params;
  return handleDeleteSet(id, authContext);
});
