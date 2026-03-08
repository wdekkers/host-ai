import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  contactName: z.string().min(1, 'Contact name is required'),
  companyName: z.string().optional(),
  phone: z.string().min(1, 'Phone number is required'),
  checkboxChecked: z.boolean(),
  sourceUrl: z.string().url(),
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

  // Extract request metadata for the consent audit trail
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null;
  const userAgent = request.headers.get('user-agent') ?? null;

  try {
    const response = await fetch(`${messagingServiceUrl}/consent/opt-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...parsed.data, ipAddress, userAgent }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Messaging service unavailable' }, { status: 502 });
  }
}
