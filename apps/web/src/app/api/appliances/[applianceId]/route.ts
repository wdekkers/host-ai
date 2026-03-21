import { withPermission } from '@/lib/auth/authorize';
import { handleUpdate, handleDelete } from '../handler';

type Params = { params: Promise<{ applianceId: string }> };

export const PATCH = withPermission('appliances.update', async (request, context: Params, authContext) => {
  const { applianceId } = await context.params;
  return handleUpdate(request, applianceId, authContext);
});

export const DELETE = withPermission('appliances.delete', async (_request, context: Params, authContext) => {
  const { applianceId } = await context.params;
  return handleDelete(applianceId, authContext);
});
