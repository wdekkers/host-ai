import { NextResponse } from 'next/server';

import { listQueue } from '@/lib/command-center-store';

export async function GET() {
  const items = listQueue();
  return NextResponse.json({
    defaultScreen: 'approval-queue',
    queueSummary: {
      total: items.length,
      pending: items.filter((item) => item.status === 'pending' || item.status === 'edited').length,
      approved: items.filter((item) => item.status === 'approved').length
    }
  });
}
