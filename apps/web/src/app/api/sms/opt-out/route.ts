import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  sendConfirmation: z.boolean().optional().default(true),
});

const messagingServiceUrl = process.env.MESSAGING_SERVICE_URL ?? 'http://127.0.0.1:4102';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${messagingServiceUrl}/consent/opt-out`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Messaging service unavailable' }, { status: 502 });
  }
}
