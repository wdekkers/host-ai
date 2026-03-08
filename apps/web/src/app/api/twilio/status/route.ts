import { NextResponse } from 'next/server';

const messagingServiceUrl = process.env.MESSAGING_SERVICE_URL ?? 'http://127.0.0.1:4102';

export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    const response = await fetch(`${messagingServiceUrl}/webhooks/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: rawBody,
    });

    const responseText = await response.text();
    return new NextResponse(responseText, {
      status: response.status,
      headers: { 'content-type': 'text/xml' },
    });
  } catch {
    return new NextResponse('<?xml version="1.0"?><Response></Response>', {
      status: 200,
      headers: { 'content-type': 'text/xml' },
    });
  }
}
