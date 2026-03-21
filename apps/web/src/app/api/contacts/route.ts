import { z } from 'zod';
import { NextResponse } from 'next/server';

import { createFallbackContact, listFallbackContacts } from '@/lib/messaging-fallback-store';

const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';

const createContactInputSchema = z.object({
  displayName: z.string().min(1),
  contactType: z.string().min(1),
  channel: z.enum(['sms', 'airbnb', 'email']),
  handle: z.string().min(1),
  preferred: z.boolean().optional()
});

export async function GET() {
  try {
    const response = await fetch(`${gatewayBaseUrl}/messaging/contacts`, {
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

  return NextResponse.json({ items: listFallbackContacts() });
}

export async function POST(request: Request) {
  const parsed = createContactInputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const response = await fetch(`${gatewayBaseUrl}/messaging/contacts`, {
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

  const item = createFallbackContact(parsed.data);
  return NextResponse.json({ item }, { status: 201 });
}
