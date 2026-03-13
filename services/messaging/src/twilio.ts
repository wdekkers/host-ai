import twilio from 'twilio';

let _client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!_client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set');
    _client = twilio(sid, token);
  }
  return _client;
}

export type SendSmsOptions = {
  to: string;
  body: string;
  from?: string;
};

/**
 * Send an outbound SMS via Twilio.
 * Uses TWILIO_MESSAGING_SERVICE_SID if set, falls back to TWILIO_PHONE_NUMBER.
 */
export async function sendSms(opts: SendSmsOptions): Promise<string | null> {
  const client = getClient();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = opts.from ?? process.env.TWILIO_PHONE_NUMBER;

  const message = await client.messages.create({
    to: opts.to,
    body: opts.body,
    ...(messagingServiceSid ? { messagingServiceSid } : { from: fromNumber }),
  });

  return message.sid ?? null;
}

/**
 * Validate a Twilio webhook request signature.
 * Returns true if the request is genuinely from Twilio.
 *
 * @param signature  Value of X-Twilio-Signature header
 * @param url        The full public URL Twilio called (must match exactly)
 * @param params     For form-encoded webhooks, the POST body as key-value pairs
 */
export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) throw new Error('TWILIO_AUTH_TOKEN is not set');
  return twilio.validateRequest(authToken, signature, url, params);
}
