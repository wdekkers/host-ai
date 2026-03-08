import { z } from 'zod';
import { NextResponse } from 'next/server';

import { setFallbackPreferredContact } from '@/lib/messaging-fallback-store';

const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';

type Params = { params: Promise<{ id: string }> };

const updateInputSchema = z.object({
  preferred: z.boolean()
});

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const parsed = updateInputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const response = await fetch(`${gatewayBaseUrl}/messaging/contacts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(parsed.data)
    });

    if (response.ok) {
      const payload = (await response.json()) as { item: unknown };
      return NextResponse.json({ item: payload.item });
    }
  } catch {
    // fallback to local store below
  }

  const item = setFallbackPreferredContact(id, parsed.data.preferred);
  if (!item) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
  }
  return NextResponse.json({ item });
}
