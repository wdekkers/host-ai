import { withPermission } from '@/lib/auth/authorize';
import { handleGetAgentConfig, handlePutAgentConfig } from './handler';

export const GET = withPermission('dashboard.read', async (request: Request, _p, authContext) =>
  handleGetAgentConfig(request, authContext),
);

export const PUT = withPermission('ops.write', async (request: Request, _p, authContext) =>
  handlePutAgentConfig(request, authContext),
);
