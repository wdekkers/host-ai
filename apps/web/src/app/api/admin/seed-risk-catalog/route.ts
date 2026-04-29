import { withPermission } from '@/lib/auth/authorize';

import { handleSeedRiskCatalog } from './handler';

export const POST = withPermission('properties.update', async (_req, _ctx, auth) =>
  handleSeedRiskCatalog({ orgId: auth.orgId }),
);
