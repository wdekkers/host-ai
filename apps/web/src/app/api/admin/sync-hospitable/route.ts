import { NextResponse } from 'next/server';
import { syncHospitable } from './handler';

export async function POST() {
  const result = await syncHospitable();
  if ('error' in result) {
    return NextResponse.json(result, { status: 503 });
  }
  return NextResponse.json(result);
}
