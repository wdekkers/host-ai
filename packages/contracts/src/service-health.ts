import { z } from 'zod';

export const serviceHealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string().min(1)
});

export type ServiceHealthResponse = z.infer<typeof serviceHealthResponseSchema>;
