import { z } from 'zod';
import { NextResponse } from 'next/server';

import { createFallbackMessage, listFallbackMessages } from '@/lib/messaging-fallback-store';

const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';

const createMessageInputSchema = z.object({
  contactId: z.string().min(1),
  direction: z.enum(['inbound', 'outbound']),
  body: z.string().min(1)
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const contactId = url.searchParams.get('contactId') ?? undefined;

  try {
    const query = contactId ? `?contactId=${encodeURIComponent(contactId)}` : '';
    const response = await fetch(`${gatewayBaseUrl}/messaging/messages${query}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store'
    });

    if (response.ok) {
      const payload = (await response.json()) as { items: unknown[] };
      return NextResponse.json({ items: payload.items ?? [] });
    }
  } catch {
    // fallback to local store below
  }

  return NextResponse.json({ items: listFallbackMessages(contactId) });
}

export async function POST(request: Request) {
  const parsed = createMessageInputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const response = await fetch(`${gatewayBaseUrl}/messaging/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(parsed.data)
    });

    if (response.ok) {
      const payload = (await response.json()) as { item: unknown };
      return NextResponse.json({ item: payload.item }, { status: 201 });
    }
  } catch {
    // fallback to local store below
  }

  const item = createFallbackMessage(parsed.data);
  if (!item) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
  }
  return NextResponse.json({ item }, { status: 201 });
}
