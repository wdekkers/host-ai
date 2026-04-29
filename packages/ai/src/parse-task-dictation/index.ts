import type { TextBlock } from '@anthropic-ai/sdk/resources/messages/messages.js';
import {
  parseTaskDictationOutputSchema,
  type ParseTaskDictationOutput,
} from './schema.js';
import { buildSystemPrompt, buildUserPrompt } from './prompt.js';
import { createAnthropicClient } from '../anthropic-client.js';

export type ParseTaskDictationOptions = {
  transcript: string;
  today: string;
  properties: Array<{ id: string; name: string; nicknames: string[] }>;
  categories: Array<{ id: string; name: string }>;
};

export type ParseTaskDictationDeps = {
  invokeModel?: (prompt: { system: string; user: string }) => Promise<string>;
};

const DEFAULT_MODEL = 'claude-sonnet-4-6';

async function defaultInvokeModel(prompt: {
  system: string;
  user: string;
}): Promise<string> {
  const client = createAnthropicClient();
  const message = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2000,
    temperature: 0.1,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  });
  return message.content
    .filter((b): b is TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

export async function parseTaskDictation(
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
      `parseTaskDictation: failed to parse model output as JSON: ${(err as Error).message}`,
    );
  }
  const parsed = parseTaskDictationOutputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(
      `parseTaskDictation: failed to parse model output as expected schema: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}
