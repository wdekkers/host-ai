import { withPermission } from '@/lib/auth/authorize';

import { handleCreateScoringRule, handleListScoringRules } from './handler';

export const GET = withPermission('properties.read', async (_req, _ctx, auth) =>
  handleListScoringRules({ orgId: auth.orgId }),
);

export const POST = withPermission('properties.update', async (req, _ctx, auth) =>
  handleCreateScoringRule(req, { orgId: auth.orgId, userId: auth.userId }),
);
