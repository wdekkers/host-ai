import { NextResponse } from 'next/server';

import { listTrainingSignalsInSingleton } from '@/lib/command-center-store';

export async function GET() {
  return NextResponse.json({ signals: listTrainingSignalsInSingleton() });
}
