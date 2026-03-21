import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { getPropertyQaSuggestionNotificationsInSingleton } from '@/lib/command-center-store';

export const GET = withPermission('questions.read', async () =>
  NextResponse.json(getPropertyQaSuggestionNotificationsInSingleton()),
);
