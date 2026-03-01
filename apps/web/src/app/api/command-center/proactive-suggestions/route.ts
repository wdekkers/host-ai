import { NextResponse } from 'next/server';

import { getProactiveSuggestionsInSingleton } from '@/lib/command-center-store';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawLimit = url.searchParams.get('limit');

  if (rawLimit) {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
      return NextResponse.json({ error: 'limit must be between 1 and 20.' }, { status: 400 });
    }
    return NextResponse.json({ items: getProactiveSuggestionsInSingleton(parsed) });
  }

  return NextResponse.json({ items: getProactiveSuggestionsInSingleton(5) });
}
