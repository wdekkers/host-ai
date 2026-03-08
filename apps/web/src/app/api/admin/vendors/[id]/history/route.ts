import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/authorize';

const gatewayUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  try {
    const response = await fetch(`${gatewayUrl}/vendors/${id}/history`, { cache: 'no-store' });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Gateway unavailable' }, { status: 502 });
  }
}
