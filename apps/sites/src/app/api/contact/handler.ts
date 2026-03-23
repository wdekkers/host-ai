import { NextResponse } from 'next/server';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('Valid email is required.'),
  phone: z.string().optional(),
  message: z.string().min(3, 'Message is required.'),
  website: z.string().optional(),
  formStartedAt: z.number().optional(),
});

export type ContactPayload = z.infer<typeof contactSchema>;

const MIN_FORM_FILL_MS = 3500;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_LINKS = 2;

function isSuspiciousSubmission(payload: ContactPayload): boolean {
  // Honeypot check
  if (payload.website) return true;

  // Speed check
  if (payload.formStartedAt) {
    const elapsed = Date.now() - payload.formStartedAt;
    if (elapsed < MIN_FORM_FILL_MS) return true;
  }

  // Message spam checks
  if (payload.message.length > MAX_MESSAGE_LENGTH) return true;
  const linkMatches = payload.message.match(/https?:\/\/|www\./gi) ?? [];
  if (linkMatches.length > MAX_LINKS) return true;
  if (/(.)\1{8,}/.test(payload.message)) return true;

  return false;
}

export async function handleContactPost(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json();
  const result = contactSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { message: 'Validation failed.', errors: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const payload = result.data;

  // Silent reject for suspicious submissions
  if (isSuspiciousSubmission(payload)) {
    console.info('[contact] silently rejected submission', {
      email: payload.email,
    });
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }

  // Log the submission for now. In production, this would send via @walt/ses
  console.info('[contact] new lead submission', {
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    messageLength: payload.message.length,
  });

  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
