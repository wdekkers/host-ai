import { NextResponse } from 'next/server';
import { z } from 'zod';

const newsletterSchema = z.object({
  email: z.string().email('Valid email is required.'),
});

export type NewsletterPayload = z.infer<typeof newsletterSchema>;

export async function handleNewsletterPost(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json();
  const result = newsletterSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { message: result.error.issues[0]?.message ?? 'Invalid email.' },
      { status: 400 },
    );
  }

  const { email } = result.data;

  // Log the subscription for now. In production, this would call @walt/mailerlite
  console.info('[newsletter] new subscription', { email });

  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
