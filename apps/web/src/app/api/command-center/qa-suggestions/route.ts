import { NextResponse } from 'next/server';
import { propertyQaSuggestionStatusSchema } from '@walt/contracts';

import { withPermission } from '@/lib/auth/authorize';
import { listPropertyQaSuggestionsInSingleton } from '@/lib/command-center-store';
import { handleApiError } from '@/lib/secure-logger';

export const GET = withPermission('dashboard.read', async (request: Request) => {
  try {
    const url = new URL(request.url);
    const propertyId = url.searchParams.get('propertyId') ?? '';
    const statusRaw = url.searchParams.get('status');
    const status = statusRaw ? propertyQaSuggestionStatusSchema.parse(statusRaw) : undefined;
    return NextResponse.json({ items: listPropertyQaSuggestionsInSingleton(propertyId, status) });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/qa-suggestions' });
  }
});
