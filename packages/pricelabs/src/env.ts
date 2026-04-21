import { z } from 'zod';

const EnvSchema = z.object({
  PRICELABS_BASE_URL: z.string().url().default('https://api.pricelabs.co'),
});

export const pricelabsEnv = EnvSchema.parse({
  PRICELABS_BASE_URL: process.env.PRICELABS_BASE_URL,
});
