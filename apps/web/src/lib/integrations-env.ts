import { z } from 'zod';

const envSchema = z.object({
  HOSPITABLE_WEBHOOK_SECRET: z.string().trim().min(1).optional(),
  HOSPITABLE_API_KEY: z.string().trim().min(1).optional(),
  HOSPITABLE_BASE_URL: z.string().trim().url().optional(),
});

function readEnv() {
  return envSchema.parse({
    HOSPITABLE_WEBHOOK_SECRET: process.env.HOSPITABLE_WEBHOOK_SECRET,
    HOSPITABLE_API_KEY: process.env.HOSPITABLE_API_KEY,
    HOSPITABLE_BASE_URL: process.env.HOSPITABLE_BASE_URL,
  });
}

export function getHospitableWebhookSecret() {
  return readEnv().HOSPITABLE_WEBHOOK_SECRET;
}

export function getHospitableApiConfig() {
  const env = readEnv();
  if (!env.HOSPITABLE_API_KEY || !env.HOSPITABLE_BASE_URL) {
    return null;
  }

  return {
    apiKey: env.HOSPITABLE_API_KEY,
    baseUrl: env.HOSPITABLE_BASE_URL,
  };
}
