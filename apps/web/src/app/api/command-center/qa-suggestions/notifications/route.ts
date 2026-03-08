import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { getPropertyQaSuggestionNotificationsInSingleton } from '@/lib/command-center-store';

export const GET = withPermission('dashboard.read', async () =>
  NextResponse.json(getPropertyQaSuggestionNotificationsInSingleton()),
);
