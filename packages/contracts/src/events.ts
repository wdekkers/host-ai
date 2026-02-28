import { z } from 'zod';

export const eventEnvelopeSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1),
  accountId: z.string().uuid(),
  propertyId: z.string().uuid().optional(),
  aggregateId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime()
});

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;
