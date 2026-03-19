import { withPermission } from '@/lib/auth/authorize';
import { handleGetPropertyAgentConfig, handlePutPropertyAgentConfig } from './handler';

export const GET = withPermission(
  'dashboard.read',
  async (request, context, authContext) =>
    handleGetPropertyAgentConfig(request, context as { params: Promise<{ id: string }> }, authContext),
);

export const PUT = withPermission(
  'ops.write',
  async (request, context, authContext) =>
    handlePutPropertyAgentConfig(request, context as { params: Promise<{ id: string }> }, authContext),
);
