import { NextResponse } from 'next/server';

import { seedDefaultRiskSignals } from '@/lib/risk-signals-default-seed';
import { handleApiError } from '@/lib/secure-logger';

export async function handleSeedRiskCatalog(auth: { orgId: string }): Promise<Response> {
  try {
    const inserted = await seedDefaultRiskSignals(auth.orgId);
    return NextResponse.json({ inserted, organizationId: auth.orgId });
  } catch (error) {
    return handleApiError({ error, route: '/api/admin/seed-risk-catalog' });
  }
}
