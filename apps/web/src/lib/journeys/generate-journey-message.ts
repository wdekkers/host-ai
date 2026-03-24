import { SYSTEM_RULES } from '@/lib/ai/system-rules';

type AgentConfig = {
  tone: string | null;
  emojiUse: string | null;
  responseLength: string | null;
  specialInstructions: string | null;
};

type KnowledgeEntry = {
  id: string;
  label: string;
  snippet: string;
};

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type GenerateJourneyMessageInput = {
  directive: string;
  guestFirstName: string | null;
  propertyName: string;
  propertyId: string | null;
  organizationId: string;
  checkIn: Date | null;
  checkOut: Date | null;
  conversationHistory: Array<{ body: string | null; senderType: string | null }>;
};

export type GenerateJourneyMessageDeps = {
  resolveKnowledge: (orgId: string, propertyId: string | null) => Promise<KnowledgeEntry[]>;
  resolvePropertyFacts: (propertyId: string | null) => Promise<string>;
  resolveAgentConfig: (orgId: string, propertyId: string | null) => Promise<AgentConfig>;
  callAI: (messages: ChatMessage[]) => Promise<string | null>;
};

export type JourneyMessageResult = {
  suggestion: string;
  sourcesUsed: Array<{ type: string; id: string; label: string; snippet?: string }>;
};

export async function generateJourneyMessage(
  input: GenerateJourneyMessageInput,
  deps: GenerateJourneyMessageDeps,
): Promise<JourneyMessageResult | null> {
  const [knowledge, propertyFacts, agentConfig] = await Promise.all([
    deps.resolveKnowledge(input.organizationId, input.propertyId),
    deps.resolvePropertyFacts(input.propertyId),
    deps.resolveAgentConfig(input.organizationId, input.propertyId),
  ]);

  // Compute booking phase
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  let bookingPhase = 'unknown';
  if (input.checkIn && input.checkOut) {
    const ciStart = new Date(
      input.checkIn.getFullYear(),
      input.checkIn.getMonth(),
      input.checkIn.getDate(),
    );
    const coStart = new Date(
      input.checkOut.getFullYear(),
      input.checkOut.getMonth(),
      input.checkOut.getDate(),
    );
    if (todayStart < ciStart) {
      bookingPhase = 'pre-arrival (guest has NOT checked in yet)';
    } else if (todayStart >= ciStart && todayStart < coStart) {
      bookingPhase = 'currently hosting (guest is staying at the property RIGHT NOW)';
    } else {
      bookingPhase = 'post-checkout (guest has already left)';
    }
  }

  const formatDate = (d: Date | null): string =>
    d ? d.toLocaleDateString() : 'unknown';

  const tone = agentConfig.tone ?? 'warm and friendly';
  const emojiUse = agentConfig.emojiUse ?? 'light (1-2 emoji max)';
  const responseLength = agentConfig.responseLength ?? 'balanced (2-3 sentences)';
  const specialInstructions = agentConfig.specialInstructions ?? '';

  const knowledgeSection =
    knowledge.length > 0
      ? `\n\n--- Knowledge Base ---\n${knowledge
          .map((k) => `[${k.label}]: ${k.snippet}`)
          .join('\n')}`
      : '';

  const propertyFactsSection = propertyFacts
    ? `\n\n--- Property Facts ---\n${propertyFacts}`
    : '';

  const systemPrompt = `You are a short-term rental host assistant sending a scheduled message to a guest.

Today's date: ${today.toLocaleDateString()}
Property: ${input.propertyName}
Guest first name: ${input.guestFirstName ?? 'the guest'}
Check-in: ${formatDate(input.checkIn)}
Check-out: ${formatDate(input.checkOut)}
Booking phase: ${bookingPhase}

Tone: ${tone}
Emoji use: ${emojiUse}
Length: ${responseLength}
${specialInstructions ? `Special instructions: ${specialInstructions}` : ''}

${SYSTEM_RULES}${propertyFactsSection}${knowledgeSection}

--- Your Task ---
DIRECTIVE: ${input.directive}
Write a message to the guest following this directive. Use the property facts and knowledge base to include accurate details. Do not invent information that is not in the facts or knowledge base.`;

  const historyMessages: ChatMessage[] = input.conversationHistory.map((m) => ({
    role: (m.senderType === 'guest' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.body ?? '',
  }));

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
  ];

  const aiResponse = await deps.callAI(messages);
  if (!aiResponse) return null;

  const sourcesUsed: JourneyMessageResult['sourcesUsed'] = knowledge.map((k) => ({
    type: 'knowledge_entry',
    id: k.id,
    label: k.label,
    snippet: k.snippet,
  }));

  if (propertyFacts && input.propertyId) {
    sourcesUsed.push({
      type: 'property_field',
      id: input.propertyId,
      label: 'Listing details',
      snippet: propertyFacts.slice(0, 120),
    });
  }

  return { suggestion: aiResponse, sourcesUsed };
}
