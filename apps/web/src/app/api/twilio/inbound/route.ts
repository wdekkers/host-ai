import { NextResponse } from 'next/server';
import twilio from 'twilio';

const messagingServiceUrl = process.env.MESSAGING_SERVICE_URL ?? 'http://127.0.0.1:4102';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  // Validate Twilio signature before proxying — skipped in non-production to ease local testing
  if (process.env.NODE_ENV === 'production') {
    const signature = request.headers.get('x-twilio-signature') ?? '';
    const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/inbound`;
    const isValid = twilio.validateRequest(authToken, signature, webhookUrl, params);
    if (!isValid) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  try {
    const response = await fetch(`${messagingServiceUrl}/webhooks/inbound`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        // Tell messaging service to skip re-validation — we already validated above
        'x-twilio-validated': 'true',
      },
      body: rawBody,
    });

    const responseText = await response.text();
    return new NextResponse(responseText, {
      status: response.status,
      headers: { 'content-type': 'text/xml' },
    });
  } catch {
    // Always return valid TwiML so Twilio doesn't retry aggressively
    return new NextResponse('<?xml version="1.0"?><Response></Response>', {
      status: 200,
      headers: { 'content-type': 'text/xml' },
    });
  }
}
