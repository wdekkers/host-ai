import { NextResponse } from 'next/server';

const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';

export async function GET() {
  try {
    const response = await fetch(`${gatewayBaseUrl}/messaging/contacts`, {
      headers: { accept: 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Gateway returned ${response.status}` }, { status: response.status });
    }

    const payload = (await response.json()) as { items: unknown[] };
    return NextResponse.json({ items: payload.items ?? [] });
  } catch {
    return NextResponse.json({ error: 'Gateway unavailable' }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const response = await fetch(`${gatewayBaseUrl}/messaging/contacts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(await request.json())
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      return NextResponse.json({ error: payload.error ?? `Gateway returned ${response.status}` }, { status: response.status });
    }

    const payload = (await response.json()) as { item: unknown };
    return NextResponse.json({ item: payload.item }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Gateway unavailable' }, { status: 502 });
  }
}
