import { NextResponse } from 'next/server';

const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const response = await fetch(`${gatewayBaseUrl}/tasks/${encodeURIComponent(id)}`, {
      headers: {
        accept: 'application/json',
        authorization: request.headers.get('authorization') ?? '',
      },
      cache: 'no-store',
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Tasks service unavailable' }, { status: 502 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const response = await fetch(`${gatewayBaseUrl}/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: request.headers.get('authorization') ?? '',
      },
      cache: 'no-store',
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Tasks service unavailable' }, { status: 502 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const response = await fetch(`${gatewayBaseUrl}/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        accept: 'application/json',
        authorization: request.headers.get('authorization') ?? '',
      },
      cache: 'no-store',
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Tasks service unavailable' }, { status: 502 });
  }
}
