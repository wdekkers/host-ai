import { z } from 'zod';

export const messageDraftRequestSchema = z.object({
  reservationId: z.string().min(1),
  intent: z.string().min(1),
  context: z.record(z.string(), z.unknown()),
});

export const messageDraftResponseSchema = z.object({
  draftId: z.string().uuid(),
  body: z.string().min(1),
  sources: z.array(z.string()).default([]),
});

export type MessageDraftRequest = z.infer<typeof messageDraftRequestSchema>;
export type MessageDraftResponse = z.infer<typeof messageDraftResponseSchema>;
