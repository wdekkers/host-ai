import Anthropic from '@anthropic-ai/sdk';
import { detectEscalationKeywords, type EscalationLevel } from './escalation-keywords';

export type MessageContext = {
  body: string;
  guestFirstName: string;
  propertyName: string;
  arrivalDate: string;
};

export type SuggestedTask = {
  title: string;
  description: string;
};

export type MessageAnalysis = {
  intent: string;
  escalationLevel: EscalationLevel;
  escalationReason: string | null;
  suggestedTask: SuggestedTask | null;
  needsReply: boolean;
};

type AnalyzeDeps = {
  callAi?: (prompt: string) => Promise<string>;
};

const SYSTEM_PROMPT = `You are a property management assistant. Analyze a guest message and return JSON with:

1. "intent": classify the message intent. Use one of: booking_request, house_rules, check_in_reminder, first_morning_check, checkout, pool_heating, early_check_in, late_checkout, spa_how_to, sauna_how_to, general_question, complaint, compliment, unknown
2. "escalationLevel": "none" | "caution" | "escalate"
   - "escalate": refund/comp requests, safety incidents, accusations, threats, claims of injury, policy exceptions, money collection, guest expressing significant anger/distress
   - "caution": complaints about amenities, requests for exceptions, mentions of reviews, mild frustration
   - "none": standard questions, informational, positive messages
3. "escalationReason": null if none, otherwise a brief explanation
4. "hasSuggestedTask": true if a host action is needed (pool/spa requests, early check-in, late check-out, extra supplies, special occasions)
5. "taskTitle": short title if hasSuggestedTask (under 60 chars, include guest name and property)
6. "taskDescription": brief description if hasSuggestedTask
7. "needsReply": true if the host should respond, false if the message is a conversation-ender
   (e.g. "Thanks!", "Ok got it", "Sounds good", "Perfect", simple acknowledgments with no question)

Respond ONLY with valid JSON.`;

async function defaultCallAi(prompt: string): Promise<string> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = response.content[0];
  if (block?.type !== 'text') throw new Error('Unexpected AI response type');
  return block.text;
}

function resolveEscalation(
  keywordLevel: EscalationLevel,
  llmLevel: EscalationLevel,
): EscalationLevel {
  if (llmLevel === 'escalate' || llmLevel === 'caution') return llmLevel;
  if (keywordLevel === 'escalate' && llmLevel === 'none') return 'caution';
  return 'none';
}

export async function analyzeMessage(
  context: MessageContext,
  deps: AnalyzeDeps = {},
): Promise<MessageAnalysis> {
  const callAi = deps.callAi ?? defaultCallAi;
  const keywordLevel = detectEscalationKeywords(context.body);

  const prompt = `Property: ${context.propertyName}
Guest first name: ${context.guestFirstName}
Arrival date: ${context.arrivalDate}
Message: "${context.body}"`;

  const raw = await callAi(prompt);

  let parsed: {
    intent?: string;
    escalationLevel?: string;
    escalationReason?: string | null;
    hasSuggestedTask?: boolean;
    taskTitle?: string;
    taskDescription?: string;
    needsReply?: boolean;
  };

  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return {
      intent: 'unknown',
      escalationLevel: keywordLevel === 'escalate' ? 'caution' : 'none',
      escalationReason: null,
      suggestedTask: null,
      needsReply: true,
    };
  }

  const llmLevel = (['none', 'caution', 'escalate'].includes(parsed.escalationLevel ?? '')
    ? parsed.escalationLevel
    : 'none') as EscalationLevel;

  const resolvedLevel = resolveEscalation(keywordLevel, llmLevel);

  const suggestedTask =
    parsed.hasSuggestedTask && parsed.taskTitle
      ? { title: parsed.taskTitle, description: parsed.taskDescription ?? '' }
      : null;

  return {
    intent: parsed.intent ?? 'unknown',
    escalationLevel: resolvedLevel,
    escalationReason: parsed.escalationReason ?? null,
    suggestedTask,
    needsReply: parsed.needsReply !== false,
  };
}
