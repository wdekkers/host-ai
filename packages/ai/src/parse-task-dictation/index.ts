import OpenAI from 'openai';
import { z } from 'zod';
import {
  parseTaskDictationOutputSchema,
  type ParseTaskDictationOutput,
} from './schema.js';
import { buildSystemPrompt, buildUserPrompt } from './prompt.js';

const envSchema = z.object({ OPENAI_API_KEY: z.string().min(1) });

export type ParseTaskDictationOptions = {
  transcript: string;
  today: string;
  properties: Array<{ id: string; name: string; nicknames: string[] }>;
  categories: Array<{ id: string; name: string }>;
};

export type ParseTaskDictationDeps = {
  invokeModel?: (prompt: { system: string; user: string }) => Promise<string>;
};

const DEFAULT_MODEL = 'gpt-4o-mini';

async function defaultInvokeModel(prompt: {
  system: string;
  user: string;
}): Promise<string> {
  const env = envSchema.parse(process.env);
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    max_tokens: 2000,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
  });
  return response.choices[0]?.message?.content ?? '';
}

export async function parseTaskDictationWithOpenAi(
  options: ParseTaskDictationOptions,
  deps: ParseTaskDictationDeps = {},
): Promise<ParseTaskDictationOutput> {
  const invoke = deps.invokeModel ?? defaultInvokeModel;
  const prompt = {
    system: buildSystemPrompt(options),
    user: buildUserPrompt(options),
  };
  const raw = await invoke(prompt);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `parseTaskDictationWithOpenAi: failed to parse model output as JSON: ${(err as Error).message}`,
    );
  }
  const parsed = parseTaskDictationOutputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(
      `parseTaskDictationWithOpenAi: failed to parse model output as expected schema: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}
