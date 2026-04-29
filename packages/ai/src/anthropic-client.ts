import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const envSchema = z.object({ ANTHROPIC_API_KEY: z.string().min(1) });

export function createAnthropicClient(): Anthropic {
  const env = envSchema.parse(process.env);
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}
