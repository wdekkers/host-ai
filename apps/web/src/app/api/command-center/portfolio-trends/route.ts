import { NextResponse } from 'next/server';

import { getPortfolioTrendInSingleton } from '@/lib/command-center-store';

export async function GET(_request: Request) {
  void _request;
  return NextResponse.json({ trends: getPortfolioTrendInSingleton() });
}
