import { NextResponse } from 'next/server';
import { parseTaskDictationInputSchema } from '@walt/contracts';

const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';

export async function handleParseDictation(request: Request): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const parsed = parseTaskDictationInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  try {
    const response = await fetch(`${gatewayBaseUrl}/tasks/parse-dictation`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: request.headers.get('authorization') ?? '',
      },
      cache: 'no-store',
      body: JSON.stringify(parsed.data),
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Tasks service unavailable' }, { status: 502 });
  }
}
