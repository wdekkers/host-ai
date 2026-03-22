import { z } from 'zod';
import { NextResponse } from 'next/server';

import type { AuthContext } from '@walt/contracts';
import { generateReplySuggestion } from '@/lib/generate-reply-suggestion';

const chatSchema = z.object({
  propertyId: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(['guest', 'agent']),
    content: z.string().min(1),
  })),
  guestName: z.string().optional().default('Test Guest'),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
});

export async function handleChat(request: Request, authContext: AuthContext) {
  const parsed = chatSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { propertyId, messages, guestName, checkIn, checkOut } = parsed.data;

  const now = new Date();
  const defaultCheckIn = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
  const defaultCheckOut = new Date(now.getTime() + 86400000 * 4).toISOString().split('T')[0];

  const conversationHistory = messages.map((m) => ({
    body: m.content,
    senderType: m.role === 'guest' ? 'guest' : 'host',
  }));

  const reply = await generateReplySuggestion({
    guestFirstName: guestName.split(' ')[0] ?? 'Test',
    guestLastName: guestName.split(' ').slice(1).join(' ') || 'Guest',
    propertyName: 'Simulator',
    propertyId,
    organizationId: authContext.orgId,
    checkIn: checkIn ?? defaultCheckIn ?? null,
    checkOut: checkOut ?? defaultCheckOut ?? null,
    conversationHistory,
  });

  if (!reply) {
    return NextResponse.json({ error: 'Failed to generate reply' }, { status: 503 });
  }

  return NextResponse.json({ reply });
}
