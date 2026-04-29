import OpenAI from 'openai';
import { z } from 'zod';

const envSchema = z.object({ OPENAI_API_KEY: z.string().min(1) });

export async function transcribeWithWhisper(audio: File): Promise<string> {
  const env = envSchema.parse(process.env);
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const result = await client.audio.transcriptions.create({
    file: audio,
    model: 'whisper-1',
  });
  return result.text;
}
