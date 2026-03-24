import { journeyDefinitionSchema, type JourneyDefinition } from '@walt/contracts';

export type GenerateInput = {
  prompt: string;
  propertyIds: string[];
  organizationId: string;
};

export type GenerateDeps = {
  resolvePropertyContext: (orgId: string, propertyIds: string[]) => Promise<string>;
  callAI: (systemPrompt: string, userPrompt: string) => Promise<string>;
};

export type GenerateResult =
  | { success: true; journey: JourneyDefinition; considerations: string[] }
  | { success: false; error: string };

const TRIGGER_TYPES = [
  'booking_confirmed',
  'check_in_approaching',
  'check_in',
  'check_out_approaching',
  'check_out',
  'message_received',
  'gap_detected',
  'sentiment_changed',
  'booking_cancelled',
  'manual',
] as const;

const STEP_TYPES = [
  'send_message',
  'wait',
  'ai_decision',
  'create_task',
  'send_notification',
  'upsell_offer',
  'pause_ai',
  'resume_ai',
] as const;

function buildSystemPrompt(): string {
  return `You are a journey automation designer for short-term rental hosts. Given a natural language request, generate a journey definition as valid JSON.

Available trigger types (use exactly one):
${TRIGGER_TYPES.map((t) => `  - ${t}`).join('\n')}

Available step types:
${STEP_TYPES.map((s) => `  - ${s}`).join('\n')}

Wait step directive formats:
  - Delay by minutes: { "delayMinutes": 60 }
  - Wait until event offset: { "until": "check_in", "offsetHours": -24 }

Rules:
- Default approvalMode to "draft"
- The "directive" field for send_message and upsell_offer steps must be a plain string describing what to say
- The "directive" field for wait steps must be an object with delayMinutes or until/offsetHours
- The "directive" field for create_task steps must be an object with title, priority, and optional description
- The "directive" field for send_notification steps must be an object with channels array and message string
- The "directive" field for ai_decision steps must be a string describing the decision to make
- coverageSchedule should be null unless the user specifically requests coverage windows
- Return ONLY valid JSON — no markdown, no code fences, no explanation text

Return a JSON object in this exact format:
{
  "journey": {
    "name": "string",
    "description": "string (optional)",
    "triggerType": "one of the trigger types above",
    "triggerConfig": {},
    "steps": [
      { "type": "step_type", "directive": "string or object" }
    ],
    "coverageSchedule": null,
    "approvalMode": "draft"
  },
  "considerations": [
    "Any edge cases, assumptions, or things the host should review"
  ]
}`;
}

export async function generateJourneyFromPrompt(
  input: GenerateInput,
  deps: GenerateDeps,
): Promise<GenerateResult> {
  let propertyContext: string;
  let rawResponse: string;

  try {
    propertyContext = await deps.resolvePropertyContext(input.organizationId, input.propertyIds);
  } catch {
    propertyContext = '';
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = [
    `Request: ${input.prompt}`,
    propertyContext ? `\nProperty context:\n${propertyContext}` : '',
  ]
    .filter(Boolean)
    .join('');

  try {
    rawResponse = await deps.callAI(systemPrompt, userPrompt);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown AI error';
    return { success: false, error: message };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResponse);
  } catch {
    return { success: false, error: 'AI returned invalid JSON' };
  }

  // Handle both { journey: {...}, considerations: [...] } and bare journey object
  let journeyCandidate: unknown;
  let considerations: string[] = [];

  if (
    parsed !== null &&
    typeof parsed === 'object' &&
    'journey' in (parsed as Record<string, unknown>)
  ) {
    const wrapper = parsed as Record<string, unknown>;
    journeyCandidate = wrapper.journey;
    if (Array.isArray(wrapper.considerations)) {
      considerations = (wrapper.considerations as unknown[]).filter(
        (c): c is string => typeof c === 'string',
      );
    }
  } else {
    journeyCandidate = parsed;
  }

  const validation = journeyDefinitionSchema.safeParse(journeyCandidate);
  if (!validation.success) {
    return { success: false, error: validation.error.message };
  }

  return { success: true, journey: validation.data, considerations };
}
