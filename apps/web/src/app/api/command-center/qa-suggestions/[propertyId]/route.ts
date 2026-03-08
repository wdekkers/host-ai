import { NextResponse } from 'next/server';
import { propertyQaSuggestionStatusSchema } from '@walt/contracts';

import { withPermission } from '@/lib/auth/authorize';
import { listPropertyQaSuggestionsInSingleton } from '@/lib/command-center-store';
import { handleApiError } from '@/lib/secure-logger';

type Params = { params: Promise<{ propertyId: string }> };

export const GET = withPermission(
  'dashboard.read',
  async (request: Request, { params }: Params) => {
    const { propertyId } = await params;
    try {
      const statusRaw = new URL(request.url).searchParams.get('status');
      const status = statusRaw ? propertyQaSuggestionStatusSchema.parse(statusRaw) : undefined;
      return NextResponse.json({ items: listPropertyQaSuggestionsInSingleton(propertyId, status) });
    } catch (error) {
      return handleApiError({ error, route: '/api/command-center/qa-suggestions/[propertyId]' });
    }
  },
);
