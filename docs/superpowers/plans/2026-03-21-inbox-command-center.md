# Inbox Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the existing inbox into a communication command center with draft lifecycle tracking, source citations, escalation detection, and Hospitable send integration.

**Architecture:** Evolve existing inbox — no new pages. Add columns to `messages` table for draft metadata, a new `draft_events` audit table, enhance AI generation to return sources + escalation, refactor existing routes to `handler.ts` pattern, wire Hospitable API for actual message sending, and enhance UI with escalation badges, intent chips, and source citations.

**Tech Stack:** Next.js 15 (App Router), Drizzle ORM (PostgreSQL), OpenAI GPT-4o-mini, Anthropic Claude Haiku, shadcn/ui + Tailwind CSS v4, Hospitable REST API, Node.js built-in test runner.

**Spec:** `docs/superpowers/specs/2026-03-21-approval-queue-inbox-enhancement-design.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `apps/web/src/lib/ai/escalation-keywords.ts` | Keyword pre-filter constants and matcher |
| `apps/web/src/lib/ai/analyze-message.ts` | Combined intent + escalation + task classification |
| `apps/web/src/lib/ai/analyze-message.test.ts` | Tests for analyzeMessage |
| `apps/web/src/lib/ai/escalation-keywords.test.ts` | Tests for keyword matcher |
| `apps/web/src/lib/hospitable/send-message.ts` | Hospitable API adapter for sending messages |
| `apps/web/src/lib/hospitable/send-message.test.ts` | Tests for send adapter |
| `apps/web/src/app/api/inbox/handler.ts` | Business logic for GET /api/inbox |
| `apps/web/src/app/api/inbox/[reservationId]/suggest/handler.ts` | Business logic for suggest |
| `apps/web/src/app/api/inbox/[reservationId]/send/handler.ts` | Business logic for send |
| `apps/web/src/app/api/inbox/[reservationId]/reject/handler.ts` | Reject draft business logic |
| `apps/web/src/app/api/inbox/[reservationId]/reject/route.ts` | Reject route (thin wrapper) |
| `apps/web/src/app/api/inbox/[reservationId]/draft-history/handler.ts` | Draft history business logic |
| `apps/web/src/app/api/inbox/[reservationId]/draft-history/route.ts` | Draft history route (thin wrapper) |
| `apps/web/src/app/api/inbox/[reservationId]/messages/handler.ts` | Business logic for messages GET |

### Modified files
| File | Changes |
|------|---------|
| `packages/db/src/schema.ts` | Add columns to `messages`, add `draftEvents` table |
| `apps/web/src/lib/generate-reply-suggestion.ts` | Return `SuggestionResult` with `sourcesUsed` |
| `apps/web/src/lib/ai/classify-message.ts` | No changes (preserved, wrapped by analyzeMessage) |
| `apps/web/src/app/api/inbox/route.ts` | Thin wrapper delegating to handler.ts |
| `apps/web/src/app/api/inbox/[reservationId]/suggest/route.ts` | Thin wrapper delegating to handler.ts |
| `apps/web/src/app/api/inbox/[reservationId]/send/route.ts` | Thin wrapper delegating to handler.ts |
| `apps/web/src/app/api/cron/scan-messages/handler.ts` | Enhanced flow with analyzeMessage + draft events |
| `apps/web/src/app/api/cron/scan-messages/handler.test.ts` | Updated tests |
| `apps/web/src/app/inbox/ConversationList.tsx` | Sorting, escalation badges, intent chips, filter tab |
| `apps/web/src/app/inbox/AiDraftPanel.tsx` | Sources section, escalation banner, reject, color fix |
| `apps/web/src/app/inbox/ConversationThread.tsx` | AI-assisted send indicator |
| `apps/web/src/app/api/inbox/[reservationId]/messages/route.ts` | Thin wrapper delegating to handler.ts |

---

## Task 1: Schema — Add draft columns to messages + draftEvents table

**Files:**
- Modify: `packages/db/src/schema.ts:199-222`

- [ ] **Step 1: Add new columns to `messages` table**

In `packages/db/src/schema.ts`, add these columns to the `messages` table definition (after `suggestionScannedAt` on line 214):

```typescript
    draftStatus: text('draft_status'),
    intent: text('intent'),
    escalationLevel: text('escalation_level'),
    escalationReason: text('escalation_reason'),
    sourcesUsed: jsonb('sources_used'),
```

- [ ] **Step 2: Add `draftEvents` table**

After the `messages` table block (after line 222), add:

```typescript
export const draftEvents = waltSchema.table(
  'draft_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id),
    action: text('action').notNull(),
    actorId: text('actor_id'),
    beforePayload: text('before_payload'),
    afterPayload: text('after_payload'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    messageCreatedIdx: index('draft_events_message_created_idx').on(
      table.messageId,
      table.createdAt,
    ),
    orgCreatedIdx: index('draft_events_org_created_idx').on(
      table.organizationId,
      table.createdAt,
    ),
  }),
);
```

- [ ] **Step 3: Run typecheck to verify schema compiles**

Run: `pnpm turbo run typecheck --filter=@walt/db`
Expected: PASS

- [ ] **Step 4: Push migration to database**

Run: `cd packages/db && pnpm drizzle-kit push`
Expected: Schema changes applied to Postgres

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): add draft lifecycle columns to messages + draftEvents table"
```

---

## Task 2: Escalation keyword pre-filter

**Files:**
- Create: `apps/web/src/lib/ai/escalation-keywords.ts`
- Create: `apps/web/src/lib/ai/escalation-keywords.test.ts`

- [ ] **Step 1: Write the test**

Create `apps/web/src/lib/ai/escalation-keywords.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { detectEscalationKeywords } from './escalation-keywords.js';

void test('detects escalate-level keywords', () => {
  assert.equal(detectEscalationKeywords('I want a refund immediately'), 'escalate');
  assert.equal(detectEscalationKeywords('My lawyer will be in touch'), 'escalate');
  assert.equal(detectEscalationKeywords('Someone was injured at the pool'), 'escalate');
});

void test('detects caution-level keywords', () => {
  assert.equal(detectEscalationKeywords('The AC is broken and not working'), 'caution');
  assert.equal(detectEscalationKeywords('I will leave a bad review'), 'caution');
  assert.equal(detectEscalationKeywords('I want compensation for this'), 'caution');
});

void test('returns none for normal messages', () => {
  assert.equal(detectEscalationKeywords('What time is check-in?'), 'none');
  assert.equal(detectEscalationKeywords('Can we heat the pool?'), 'none');
  assert.equal(detectEscalationKeywords('Thanks for a great stay!'), 'none');
});

void test('is case-insensitive', () => {
  assert.equal(detectEscalationKeywords('I WANT A REFUND'), 'escalate');
  assert.equal(detectEscalationKeywords('This is UNACCEPTABLE'), 'caution');
});

void test('escalate takes priority over caution', () => {
  assert.equal(detectEscalationKeywords('This broken thing caused an injury, I want a refund'), 'escalate');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && node --experimental-strip-types --test src/lib/ai/escalation-keywords.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/ai/escalation-keywords.ts`:

```typescript
const ESCALATE_KEYWORDS = [
  'refund', 'lawyer', 'attorney', 'sue', 'injured', 'injury',
  'blood', 'hospital', 'police', 'fire department', 'weapon',
  'threatened', 'unsafe', 'discriminat',
];

const CAUTION_KEYWORDS = [
  'damage', 'broken', 'not working', 'disgusting', 'unacceptable',
  'worst', 'review', 'report', 'complain', 'compensat', 'money back',
  'airbnb support', 'resolution center',
];

export type EscalationLevel = 'none' | 'caution' | 'escalate';

export function detectEscalationKeywords(text: string): EscalationLevel {
  const lower = text.toLowerCase();

  for (const keyword of ESCALATE_KEYWORDS) {
    if (lower.includes(keyword)) return 'escalate';
  }

  for (const keyword of CAUTION_KEYWORDS) {
    if (lower.includes(keyword)) return 'caution';
  }

  return 'none';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && node --experimental-strip-types --test src/lib/ai/escalation-keywords.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/ai/escalation-keywords.ts apps/web/src/lib/ai/escalation-keywords.test.ts
git commit -m "feat(ai): add escalation keyword pre-filter"
```

---

## Task 3: analyzeMessage — unified intent + escalation + task classification

**Files:**
- Create: `apps/web/src/lib/ai/analyze-message.ts`
- Create: `apps/web/src/lib/ai/analyze-message.test.ts`

- [ ] **Step 1: Write the test**

Create `apps/web/src/lib/ai/analyze-message.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeMessage, type MessageAnalysis } from './analyze-message.js';

void test('returns intent, escalation, and suggestedTask from LLM', async () => {
  const result = await analyzeMessage(
    {
      body: 'Can we check in at 2pm instead of 4pm?',
      guestFirstName: 'Alice',
      propertyName: 'Palmera',
      arrivalDate: '2026-03-25',
    },
    {
      callAi: async () => JSON.stringify({
        intent: 'early_check_in',
        escalationLevel: 'none',
        escalationReason: null,
        hasSuggestedTask: true,
        taskTitle: 'Early check-in request for Alice at Palmera',
        taskDescription: 'Guest wants to check in at 2pm instead of 4pm.',
      }),
    },
  );

  assert.equal(result.intent, 'early_check_in');
  assert.equal(result.escalationLevel, 'none');
  assert.equal(result.escalationReason, null);
  assert.ok(result.suggestedTask);
  assert.equal(result.suggestedTask!.title, 'Early check-in request for Alice at Palmera');
});

void test('keyword escalate + LLM none = caution', async () => {
  const result = await analyzeMessage(
    {
      body: 'The refund policy seems confusing, can you clarify check-in time?',
      guestFirstName: 'Bob',
      propertyName: 'Casa Sol',
      arrivalDate: '2026-04-01',
    },
    {
      callAi: async () => JSON.stringify({
        intent: 'general_question',
        escalationLevel: 'none',
        escalationReason: null,
        hasSuggestedTask: false,
      }),
    },
  );

  // 'refund' keyword triggers escalate, but LLM says none → resolve to caution
  assert.equal(result.escalationLevel, 'caution');
});

void test('keyword caution + LLM none = none', async () => {
  const result = await analyzeMessage(
    {
      body: 'Can you report the wifi name? I want to review it before arrival.',
      guestFirstName: 'Carol',
      propertyName: 'Villa Nova',
      arrivalDate: '2026-04-05',
    },
    {
      callAi: async () => JSON.stringify({
        intent: 'general_question',
        escalationLevel: 'none',
        escalationReason: null,
        hasSuggestedTask: false,
      }),
    },
  );

  // 'report' and 'review' are caution keywords, but LLM says none → trust LLM
  assert.equal(result.escalationLevel, 'none');
});

void test('LLM escalation overrides keyword none', async () => {
  const result = await analyzeMessage(
    {
      body: 'I am extremely unhappy with how this situation was handled.',
      guestFirstName: 'Dave',
      propertyName: 'Beachside',
      arrivalDate: '2026-04-10',
    },
    {
      callAi: async () => JSON.stringify({
        intent: 'complaint',
        escalationLevel: 'escalate',
        escalationReason: 'Guest expressing significant distress about service',
        hasSuggestedTask: false,
      }),
    },
  );

  assert.equal(result.escalationLevel, 'escalate');
  assert.equal(result.escalationReason, 'Guest expressing significant distress about service');
});

void test('returns defaults on JSON parse failure', async () => {
  const result = await analyzeMessage(
    {
      body: 'Hello',
      guestFirstName: 'Eve',
      propertyName: 'Sunset',
      arrivalDate: '2026-04-15',
    },
    {
      callAi: async () => 'not valid json',
    },
  );

  assert.equal(result.intent, 'unknown');
  assert.equal(result.escalationLevel, 'none');
  assert.equal(result.suggestedTask, null);
});

void test('parse failure with escalation keyword falls back to caution', async () => {
  const result = await analyzeMessage(
    {
      body: 'I want a refund for this terrible experience',
      guestFirstName: 'Frank',
      propertyName: 'Beach House',
      arrivalDate: '2026-04-20',
    },
    {
      callAi: async () => 'not valid json',
    },
  );

  // 'refund' keyword triggers escalate, but LLM failed → caution as safety net
  assert.equal(result.escalationLevel, 'caution');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && node --experimental-strip-types --test src/lib/ai/analyze-message.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/ai/analyze-message.ts`:

```typescript
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
  // LLM is authoritative
  if (llmLevel === 'escalate' || llmLevel === 'caution') return llmLevel;

  // LLM says none but keywords flagged escalate → use caution (safety net)
  if (keywordLevel === 'escalate' && llmLevel === 'none') return 'caution';

  // LLM says none and keywords flagged caution → trust LLM (keywords are noisy)
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
  };

  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return {
      intent: 'unknown',
      escalationLevel: keywordLevel === 'escalate' ? 'caution' : 'none',
      escalationReason: null,
      suggestedTask: null,
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
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && node --experimental-strip-types --test src/lib/ai/analyze-message.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/ai/analyze-message.ts apps/web/src/lib/ai/analyze-message.test.ts
git commit -m "feat(ai): add analyzeMessage with hybrid keyword + LLM escalation detection"
```

---

## Task 4: Enhance generateReplySuggestion to return sourcesUsed

**Files:**
- Modify: `apps/web/src/lib/generate-reply-suggestion.ts`

- [ ] **Step 1: Add SourceReference type and update return type**

At the top of `generate-reply-suggestion.ts` (after imports), add:

```typescript
export type SourceReference = {
  type: 'knowledge_entry' | 'property_field' | 'property_memory';
  id: string;
  label: string;
  snippet?: string;
};

export type SuggestionResult = {
  suggestion: string;
  sourcesUsed: SourceReference[];
};
```

- [ ] **Step 2: Track sources as they're fetched**

Inside the function body, after line 91 where `knowledgeContext` is built, add source tracking. Change the knowledge resolution block (lines 85-91) to:

```typescript
  const aiKnowledge = await resolveKnowledgeForProperty({
    source: knowledgeSource,
    organizationId,
    propertyId,
    channels: ['ai'],
  });
  const knowledgeContext = formatKnowledgeForPrompt(aiKnowledge);

  const sourcesUsed: SourceReference[] = aiKnowledge.map((entry) => ({
    type: 'knowledge_entry' as const,
    id: entry.id,
    label: entry.question ?? entry.answer?.slice(0, 60) ?? 'Knowledge entry',
    snippet: entry.answer?.slice(0, 120),
  }));
```

After the memory fetching block (lines 93-104), add source tracking for memory facts:

```typescript
  if (propertyId) {
    const facts = await db
      .select({ id: propertyMemory.id, fact: propertyMemory.fact })
      .from(propertyMemory)
      .where(eq(propertyMemory.propertyId, propertyId))
      .limit(20);
    if (facts.length > 0) {
      memoryContext = `\n\nProperty facts (learned):\n${facts.map((f) => `- ${f.fact}`).join('\n')}`;
      for (const f of facts) {
        sourcesUsed.push({
          type: 'property_memory',
          id: f.id,
          label: f.fact.slice(0, 60),
          snippet: f.fact.slice(0, 120),
        });
      }
    }
  }
```

Note: The memory select now includes `id` alongside `fact`.

- [ ] **Step 3: Change return type from `string | null` to `SuggestionResult | null`**

Change the function signature return type to `Promise<SuggestionResult | null>`.

Change the final return (line 183) from:

```typescript
  return response.choices[0]?.message?.content ?? null;
```

to:

```typescript
  const content = response.choices[0]?.message?.content ?? null;
  if (!content) return null;
  return { suggestion: content, sourcesUsed };
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: Some errors in files that call `generateReplySuggestion` and expect `string | null` — this is expected and will be fixed in later tasks.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/generate-reply-suggestion.ts
git commit -m "feat(ai): enhance generateReplySuggestion to return sourcesUsed"
```

---

## Task 5: Hospitable send adapter

**Files:**
- Create: `apps/web/src/lib/hospitable/send-message.ts`
- Create: `apps/web/src/lib/hospitable/send-message.test.ts`

- [ ] **Step 1: Write the test**

Create `apps/web/src/lib/hospitable/send-message.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { sendViaHospitable, type SendResult } from './send-message.js';

void test('sends message successfully', async () => {
  const result = await sendViaHospitable(
    { conversationId: 'conv-1', body: 'Hello guest!' },
    {
      fetch: async (url, init) => {
        assert.ok(String(url).includes('/v2/conversations/conv-1/messages'));
        assert.equal(init?.method, 'POST');
        const body = JSON.parse(init?.body as string);
        assert.equal(body.body, 'Hello guest!');
        return new Response(JSON.stringify({ id: 'msg-123' }), { status: 200 });
      },
      apiKey: 'test-key',
      baseUrl: 'https://api.hospitable.com',
    },
  );

  assert.equal(result.success, true);
  assert.equal(result.platformMessageId, 'msg-123');
});

void test('returns error on API failure', async () => {
  const result = await sendViaHospitable(
    { conversationId: 'conv-1', body: 'Hello!' },
    {
      fetch: async () => new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 }),
      apiKey: 'test-key',
      baseUrl: 'https://api.hospitable.com',
    },
  );

  assert.equal(result.success, false);
  assert.ok(result.error?.includes('429'));
});

void test('returns error when config missing', async () => {
  const result = await sendViaHospitable(
    { conversationId: 'conv-1', body: 'Hello!' },
    { apiKey: '', baseUrl: '' },
  );

  assert.equal(result.success, false);
  assert.ok(result.error?.includes('not configured'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && node --experimental-strip-types --test src/lib/hospitable/send-message.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/hospitable/send-message.ts`:

```typescript
import { getHospitableApiConfig } from '@/lib/integrations-env';

export type SendResult = {
  success: boolean;
  platformMessageId?: string;
  error?: string;
};

type SendInput = {
  conversationId: string;
  body: string;
};

type SendDeps = {
  fetch?: typeof globalThis.fetch;
  apiKey?: string;
  baseUrl?: string;
};

export async function sendViaHospitable(
  input: SendInput,
  deps: SendDeps = {},
): Promise<SendResult> {
  const config = deps.apiKey && deps.baseUrl
    ? { apiKey: deps.apiKey, baseUrl: deps.baseUrl }
    : getHospitableApiConfig();

  if (!config) {
    return { success: false, error: 'Hospitable API not configured' };
  }

  const fetchFn = deps.fetch ?? globalThis.fetch;
  const url = new URL(
    `/v2/conversations/${input.conversationId}/messages`,
    config.baseUrl,
  );

  let response: Response;
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ body: input.body }),
    });
  } catch (err) {
    return {
      success: false,
      error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!response.ok) {
    return {
      success: false,
      error: `Hospitable API returned ${response.status}`,
    };
  }

  const data = (await response.json()) as Record<string, unknown>;
  return {
    success: true,
    platformMessageId: typeof data.id === 'string' ? data.id : undefined,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && node --experimental-strip-types --test src/lib/hospitable/send-message.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/hospitable/send-message.ts apps/web/src/lib/hospitable/send-message.test.ts
git commit -m "feat(hospitable): add send-message adapter for platform delivery"
```

---

## Task 6: Refactor inbox GET route to handler.ts pattern + add new fields

**Files:**
- Create: `apps/web/src/app/api/inbox/handler.ts`
- Modify: `apps/web/src/app/api/inbox/route.ts`

- [ ] **Step 1: Create handler.ts with existing logic + enhancements**

Create `apps/web/src/app/api/inbox/handler.ts`. Move the entire GET logic from `route.ts` into a `handleGetInbox` function. Add the new fields (`draftStatus`, `intent`, `escalationLevel`, `escalationReason`) to the query and response. Add the `escalated` filter. Update sorting: unreplied first (oldest waiting), then by most recent activity.

The handler should:
1. Export `handleGetInbox(request: Request)`
2. Include all the existing logic from `route.ts` lines 15-147
3. Add `escalated` to the filter options
4. Include `draftStatus`, `intent`, `escalationLevel`, `escalationReason` in the `latestByReservation` map
5. Add these fields to each thread in the response
6. Sort: unreplied first (sorted ascending by lastMessageAt), then non-unreplied sorted descending by lastMessageAt

Key changes to the query — in the `mostRecentMessages` select, add the new columns:

```typescript
draftStatus: messages.draftStatus,
intent: messages.intent,
escalationLevel: messages.escalationLevel,
escalationReason: messages.escalationReason,
```

In the thread builder, add these to each thread object:

```typescript
draftStatus: latest?.draftStatus ?? null,
intent: latest?.intent ?? null,
escalationLevel: latest?.escalationLevel ?? null,
escalationReason: latest?.escalationReason ?? null,
```

Add escalated filter:

```typescript
if (filter === 'escalated') threads = threads.filter((t) =>
  t.escalationLevel === 'caution' || t.escalationLevel === 'escalate'
);
```

Update sorting after filtering:

```typescript
threads.sort((a, b) => {
  // Unreplied first
  if (a.unreplied && !b.unreplied) return -1;
  if (!a.unreplied && b.unreplied) return 1;
  // Within unreplied: oldest waiting first
  if (a.unreplied && b.unreplied) {
    return new Date(a.lastMessageAt).getTime() - new Date(b.lastMessageAt).getTime();
  }
  // Within replied: most recent first
  return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
});
```

- [ ] **Step 2: Update route.ts to be a thin wrapper**

Replace `apps/web/src/app/api/inbox/route.ts` with:

```typescript
import { handleGetInbox } from './handler';
export const GET = handleGetInbox;
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS (or only pre-existing errors from Task 4 return type change)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/inbox/handler.ts apps/web/src/app/api/inbox/route.ts
git commit -m "refactor(api): extract inbox GET to handler.ts + add draft/escalation fields"
```

---

## Task 7: Refactor suggest route to handler.ts + return enhanced result

**Files:**
- Create: `apps/web/src/app/api/inbox/[reservationId]/suggest/handler.ts`
- Modify: `apps/web/src/app/api/inbox/[reservationId]/suggest/route.ts`

- [ ] **Step 1: Create handler.ts with enhanced suggest logic**

Create `apps/web/src/app/api/inbox/[reservationId]/suggest/handler.ts`. Move all logic from `route.ts`. Enhance to:

1. Call `analyzeMessage()` first to get intent + escalation
2. Call `generateReplySuggestion()` which now returns `SuggestionResult` with `sourcesUsed`
3. Update message with all new fields: `draftStatus`, `intent`, `escalationLevel`, `escalationReason`, `sourcesUsed`
4. Insert `draftEvents` record (action: 'generated' or 'regenerated' based on whether `suggestion` already exists)
5. Return enhanced response with `suggestion`, `sourcesUsed`, `intent`, `escalationLevel`, `escalationReason`

**Note:** Skip writing to the `events` table for now. The `events.accountId` column is `uuid` but Clerk org IDs are text strings (`org_xxx`), causing a type mismatch. This will be reconciled in ticket #004 (event contracts). The `draftEvents` table (which uses `text` for `organizationId`) provides full audit trail coverage in the meantime.

Key imports to add: `analyzeMessage` from `@/lib/ai/analyze-message`, `draftEvents`, `events` from `@walt/db`.

When determining action type, check if the message already has a non-null `suggestion` — if so, use `'regenerated'`, otherwise `'generated'`.

Use `crypto.randomUUID()` for the `events` table ID (it has no default).

- [ ] **Step 2: Update route.ts to be a thin wrapper**

Replace `apps/web/src/app/api/inbox/[reservationId]/suggest/route.ts` with:

```typescript
import { handleSuggest } from './handler';
export const POST = handleSuggest;
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/inbox/[reservationId]/suggest/handler.ts apps/web/src/app/api/inbox/[reservationId]/suggest/route.ts
git commit -m "refactor(api): extract suggest to handler.ts + add analysis + source tracking"
```

---

## Task 8: Refactor send route to handler.ts + dual path + Hospitable send

**Files:**
- Create: `apps/web/src/app/api/inbox/[reservationId]/send/handler.ts`
- Modify: `apps/web/src/app/api/inbox/[reservationId]/send/route.ts`

- [ ] **Step 1: Create handler.ts with dual-path send logic**

Create `apps/web/src/app/api/inbox/[reservationId]/send/handler.ts`. Move logic from `route.ts` and enhance:

**Input:** `{ suggestion: string; messageId?: string }`

**Path A — AI-assisted reply** (messageId provided):
1. Look up the message, validate `draftStatus` is `pending_review` or null (null for pre-existing messages)
2. If sent text differs from `message.suggestion`, insert `draftEvents` (action: 'edited')
3. Insert `draftEvents` (action: 'approved', actorId from auth context)
4. Look up `reservation.conversationId` for Hospitable send
5. If `conversationId` exists, call `sendViaHospitable()`. On failure, return error without marking as sent.
6. Insert `draftEvents` (action: 'sent', metadata includes Hospitable response)
7. Update message: `draftStatus = 'sent'`
8. Create host message record (existing behavior)

**Note:** Skip `events` table writes (same UUID/text mismatch — see Task 7 note). `draftEvents` provides full audit trail.

**Path B — Manual reply** (no messageId):
1. Look up `reservation.conversationId` for Hospitable send
2. If `conversationId` exists, call `sendViaHospitable()`
3. Create host message record (existing behavior)

Key imports: `sendViaHospitable` from `@/lib/hospitable/send-message`, `draftEvents`, `events` from `@walt/db`.

- [ ] **Step 2: Update route.ts to be a thin wrapper**

Replace `apps/web/src/app/api/inbox/[reservationId]/send/route.ts` with:

```typescript
import { handleSend } from './handler';
export const POST = handleSend;
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/inbox/[reservationId]/send/handler.ts apps/web/src/app/api/inbox/[reservationId]/send/route.ts
git commit -m "refactor(api): extract send to handler.ts + dual path + Hospitable send"
```

---

## Task 9: Add reject and draft-history routes

**Files:**
- Create: `apps/web/src/app/api/inbox/[reservationId]/reject/handler.ts`
- Create: `apps/web/src/app/api/inbox/[reservationId]/reject/route.ts`
- Create: `apps/web/src/app/api/inbox/[reservationId]/draft-history/handler.ts`
- Create: `apps/web/src/app/api/inbox/[reservationId]/draft-history/route.ts`

- [ ] **Step 1: Create reject handler**

Create `apps/web/src/app/api/inbox/[reservationId]/reject/handler.ts`:

```typescript
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { messages, draftEvents } from '@walt/db';

type Params = { params: Promise<{ reservationId: string }> };

export const handleReject = withPermission(
  'inbox.create',
  async (request: Request, { params }: Params, authContext) => {
    try {
      const { reservationId } = await params;
      const body = (await request.json()) as { messageId: string; reason?: string };
      const { messageId, reason } = body;

      if (!messageId) {
        return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
      }

      const [message] = await db
        .select({ id: messages.id, draftStatus: messages.draftStatus })
        .from(messages)
        .where(eq(messages.id, messageId));

      if (!message) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      await db
        .update(messages)
        .set({ draftStatus: 'rejected' })
        .where(eq(messages.id, messageId));

      await db.insert(draftEvents).values({
        organizationId: authContext.orgId,
        messageId,
        action: 'rejected',
        actorId: authContext.userId,
        metadata: reason ? { reason } : null,
      });

      // Note: Skip events table write (UUID/text mismatch — ticket #004)

      return NextResponse.json({ ok: true });
    } catch (error) {
      return handleApiError({ error, route: '/api/inbox/[reservationId]/reject' });
    }
  },
);
```

- [ ] **Step 2: Create reject route.ts**

Create `apps/web/src/app/api/inbox/[reservationId]/reject/route.ts`:

```typescript
import { handleReject } from './handler';
export const POST = handleReject;
```

- [ ] **Step 3: Create draft-history handler**

Create `apps/web/src/app/api/inbox/[reservationId]/draft-history/handler.ts`:

```typescript
import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';
import { draftEvents } from '@walt/db';

type Params = { params: Promise<{ reservationId: string }> };

export const handleDraftHistory = withPermission(
  'inbox.read',
  async (request: Request, _ctx: Params) => {
    try {
      const url = new URL(request.url);
      const messageId = url.searchParams.get('messageId');

      if (!messageId) {
        return NextResponse.json({ error: 'messageId query param is required' }, { status: 400 });
      }

      const rows = await db
        .select({
          action: draftEvents.action,
          actorId: draftEvents.actorId,
          beforePayload: draftEvents.beforePayload,
          afterPayload: draftEvents.afterPayload,
          metadata: draftEvents.metadata,
          createdAt: draftEvents.createdAt,
        })
        .from(draftEvents)
        .where(eq(draftEvents.messageId, messageId))
        .orderBy(asc(draftEvents.createdAt));

      return NextResponse.json({
        events: rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      return handleApiError({ error, route: '/api/inbox/[reservationId]/draft-history' });
    }
  },
);
```

- [ ] **Step 4: Create draft-history route.ts**

Create `apps/web/src/app/api/inbox/[reservationId]/draft-history/route.ts`:

```typescript
import { handleDraftHistory } from './handler';
export const GET = handleDraftHistory;
```

- [ ] **Step 5: Update permissions mapping**

In `apps/web/src/lib/auth/permissions.ts`, ensure the new routes are covered. Check the `getPermissionForApiRoute` function — the inbox routes pattern at lines 105-109 should already handle these since they match `/api/inbox/**`. Verify this and add explicit entries only if needed.

- [ ] **Step 6: Run typecheck**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/inbox/[reservationId]/reject/ apps/web/src/app/api/inbox/[reservationId]/draft-history/
git commit -m "feat(api): add reject and draft-history inbox routes"
```

---

## Task 10: Enhance scan-messages cron to use analyzeMessage + generate drafts

**Files:**
- Modify: `apps/web/src/app/api/cron/scan-messages/handler.ts`
- Modify: `apps/web/src/app/api/cron/scan-messages/handler.test.ts`

- [ ] **Step 1: Update the test**

Update `handler.test.ts` to account for the new deps: `analyze`, `generateSuggestion`, `insertDraftEvent`, `updateMessageDraft`. Update existing tests and add a new test for draft generation:

Add to the `Deps` type in tests:
- `analyze` replaces `classify`
- New deps: `generateSuggestion`, `insertDraftEvent`, `updateMessageDraft`

Add test case:

```typescript
void test('generates AI draft and inserts draft event', async () => {
  let draftEventInserted = false;
  let messageDraftUpdated = false;

  await handleScanMessages(
    new Request('http://localhost/api/cron/scan-messages', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
    }),
    {
      cronSecret: 'test-secret',
      getUnscannedMessages: async () => [
        { id: 'msg-1', reservationId: 'res-1', body: 'Can we check in early?', senderType: 'guest' },
      ],
      markScanned: async () => {},
      getReservationContext: async () => ({
        reservationId: 'res-1', propertyId: 'prop-1', propertyName: 'Palmera',
        guestFirstName: 'Alice', arrivalDate: '2026-03-25', organizationId: 'org-1',
      }),
      analyze: async () => ({
        intent: 'early_check_in', escalationLevel: 'none' as const,
        escalationReason: null, suggestedTask: { title: 'Early check-in for Alice', description: 'Wants 2pm' },
      }),
      generateSuggestion: async () => ({
        suggestion: 'Let me check with our cleaners!',
        sourcesUsed: [{ type: 'knowledge_entry' as const, id: 'ke-1', label: 'Check-in policy' }],
      }),
      insertSuggestion: async () => {},
      insertDraftEvent: async () => { draftEventInserted = true; },
      updateMessageDraft: async () => { messageDraftUpdated = true; },
    },
  );

  assert.ok(draftEventInserted);
  assert.ok(messageDraftUpdated);
});
```

- [ ] **Step 2: Update handler.ts**

Add new deps to the `Deps` type:

```typescript
analyze?: (context: MessageContext) => Promise<MessageAnalysis>;
generateSuggestion?: (params: GenerateSuggestionParams) => Promise<SuggestionResult | null>;
insertDraftEvent?: (row: Record<string, unknown>) => Promise<void>;

updateMessageDraft?: (id: string, fields: Record<string, unknown>) => Promise<void>;
```

Replace the `classify` call with `analyze`. After analysis, call `generateSuggestion` to get the AI draft. Then:
1. `updateMessageDraft` with suggestion, draftStatus, intent, escalationLevel, escalationReason, sourcesUsed
2. `insertDraftEvent` with action 'generated'
3. If `suggestedTask`, `insertSuggestion` (existing behavior)

**Note:** Skip `events` table writes (UUID/text mismatch — ticket #004). `draftEvents` provides full audit trail.

Update the default implementations to use `analyzeMessage` and `generateReplySuggestion` from their respective modules.

- [ ] **Step 3: Run tests**

Run: `cd apps/web && node --experimental-strip-types --test src/app/api/cron/scan-messages/handler.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Run typecheck**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/cron/scan-messages/handler.ts apps/web/src/app/api/cron/scan-messages/handler.test.ts
git commit -m "feat(cron): enhance scan-messages with analyzeMessage + draft generation"
```

---

## Task 11: UI — ConversationList enhancements

**Files:**
- Modify: `apps/web/src/app/inbox/ConversationList.tsx`

- [ ] **Step 1: Add new fields to thread type**

Add `draftStatus`, `intent`, `escalationLevel`, `escalationReason` to the thread type used in the component.

- [ ] **Step 2: Add escalated filter tab**

Add a 4th tab "Escalated" alongside All / Unreplied / AI Ready. The count for Escalated is `threads.filter(t => t.escalationLevel === 'caution' || t.escalationLevel === 'escalate').length`. Use the filter value `'escalated'` passed to the API.

- [ ] **Step 3: Add escalation badge to thread items**

For each thread card, show an escalation indicator:
- `escalate`: red `AlertTriangle` icon (from Lucide) or red dot
- `caution`: amber `AlertTriangle` icon or amber dot
- Position: left of the guest name or as a small badge

Use Lucide `AlertTriangle` icon with `className="h-4 w-4 text-red-500"` for escalate, `"h-4 w-4 text-amber-500"` for caution.

- [ ] **Step 4: Add intent chip to thread items**

Below the guest name or next to the property name, show a small Badge with the intent label when present. Use shadcn `Badge` with `variant="secondary"` and format the intent (e.g., `early_check_in` → `Early Check-in`).

Helper function:
```typescript
function formatIntent(intent: string): string {
  return intent.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
```

- [ ] **Step 5: Run lint and typecheck**

Run: `pnpm turbo run typecheck lint --filter=@walt/web`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/inbox/ConversationList.tsx
git commit -m "feat(ui): add escalation badges, intent chips, and escalated filter to inbox"
```

---

## Task 12: UI — AiDraftPanel enhancements

**Files:**
- Modify: `apps/web/src/app/inbox/AiDraftPanel.tsx`

- [ ] **Step 1: Fix the button color**

Change `bg-green-600` (and any `hover:bg-green-700`) on the "Approve & Send" button to `bg-sky-600` / `hover:bg-sky-700`. This fixes the UI standards violation (accent is sky-600, never green).

- [ ] **Step 2: Add escalation banner**

At the top of the draft panel (before the suggestion text), add an escalation banner when `escalationLevel` is `caution` or `escalate`:

```tsx
{escalationLevel === 'escalate' && (
  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
    <div className="flex items-center gap-2">
      <AlertTriangle className="h-4 w-4" />
      <span className="font-medium">Requires manual review:</span>
    </div>
    {escalationReason && <p className="mt-1">{escalationReason}</p>}
  </div>
)}
{escalationLevel === 'caution' && (
  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
    <div className="flex items-center gap-2">
      <AlertTriangle className="h-4 w-4" />
      <span className="font-medium">Review carefully:</span>
    </div>
    {escalationReason && <p className="mt-1">{escalationReason}</p>}
  </div>
)}
```

- [ ] **Step 3: Add "Context used" collapsible sources section**

Below the draft text and above the action buttons, add a collapsible section:

```tsx
{sourcesUsed && sourcesUsed.length > 0 && (
  <details className="mt-3 rounded-md border p-2 text-sm">
    <summary className="cursor-pointer font-medium text-muted-foreground">
      Context used ({sourcesUsed.length})
    </summary>
    <ul className="mt-2 space-y-1">
      {sourcesUsed.map((source, i) => (
        <li key={i} className="flex items-start gap-2 text-muted-foreground">
          {source.type === 'knowledge_entry' && <BookOpen className="mt-0.5 h-3.5 w-3.5" />}
          {source.type === 'property_memory' && <Lightbulb className="mt-0.5 h-3.5 w-3.5" />}
          {source.type === 'property_field' && <Building className="mt-0.5 h-3.5 w-3.5" />}
          <span>{source.label}</span>
        </li>
      ))}
    </ul>
  </details>
)}
```

Import `BookOpen`, `Lightbulb`, `Building`, `AlertTriangle` from `lucide-react`.

- [ ] **Step 4: Add draft status badge**

Near the top of the draft panel (next to the "AI Draft" label or suggestion area), show the current draft state as a small badge:

```tsx
{draftStatus && (
  <Badge variant="outline" className="text-xs">
    {draftStatus === 'pending_review' && 'AI Draft'}
    {draftStatus === 'approved' && 'Approved'}
    {draftStatus === 'sent' && 'Sent'}
    {draftStatus === 'rejected' && 'Dismissed'}
  </Badge>
)}
```

Import `Badge` from `@/components/ui/badge`.

- [ ] **Step 5: Add reject/dismiss button**

Add a "Dismiss" button next to "Approve & Send":

```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={handleReject}
  className="text-muted-foreground"
>
  Dismiss
</Button>
```

The `handleReject` function calls `POST /api/inbox/{reservationId}/reject` with `{ messageId }` and clears the suggestion from the UI.

- [ ] **Step 6: Update the generate and send functions**

Update `generate()` to handle the new response shape (it now returns `{ suggestion, sourcesUsed, intent, escalationLevel, escalationReason }`). Store these in component state.

Update `handleSend()` to pass `messageId` in the POST body so the API can track the draft lifecycle.

- [ ] **Step 7: Run lint and typecheck**

Run: `pnpm turbo run typecheck lint --filter=@walt/web`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/inbox/AiDraftPanel.tsx
git commit -m "feat(ui): add escalation banner, sources panel, dismiss button, fix accent color"
```

---

## Task 13: UI — ConversationThread AI-assisted indicator + messages route refactor

**Files:**
- Create: `apps/web/src/app/api/inbox/[reservationId]/messages/handler.ts`
- Modify: `apps/web/src/app/api/inbox/[reservationId]/messages/route.ts`
- Modify: `apps/web/src/app/inbox/ConversationThread.tsx`

- [ ] **Step 1: Refactor messages route to handler.ts pattern**

Create `apps/web/src/app/api/inbox/[reservationId]/messages/handler.ts`. Move all business logic from `messages/route.ts` into a `handleGetMessages` function. Add `draftStatus` to the select fields.

- [ ] **Step 2: Update messages route.ts to thin wrapper**

Replace `apps/web/src/app/api/inbox/[reservationId]/messages/route.ts` with:

```typescript
import { handleGetMessages } from './handler';
export const GET = handleGetMessages;
```

- [ ] **Step 3: Add AI-assisted label to ConversationThread**

For host messages that were sent via the AI-assisted flow, show a small label. This can be detected by checking if the message has a `draftStatus` of `'sent'`.

In the message bubble for host messages, add:

```tsx
{msg.draftStatus === 'sent' && (
  <span className="text-xs text-muted-foreground">AI-assisted</span>
)}
```

- [ ] **Step 4: Run lint and typecheck**

Run: `pnpm turbo run typecheck lint --filter=@walt/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/inbox/ConversationThread.tsx apps/web/src/app/api/inbox/[reservationId]/messages/
git commit -m "feat(ui): add AI-assisted label + refactor messages route to handler.ts"
```

---

## Task 14: Final verification — typecheck, lint, build

**Files:** None (verification only)

- [ ] **Step 1: Run full typecheck and lint**

Run: `pnpm turbo run typecheck lint --filter=@walt/web`
Expected: PASS with no errors

- [ ] **Step 2: Run build**

Run: `pnpm turbo run build --filter=@walt/web`
Expected: PASS

- [ ] **Step 3: Run all tests**

Run: `cd apps/web && node --experimental-strip-types --test src/lib/ai/escalation-keywords.test.ts src/lib/ai/analyze-message.test.ts src/lib/hospitable/send-message.test.ts src/app/api/cron/scan-messages/handler.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Verify locally**

Start the dev server: `pnpm --filter @walt/web dev`
- Navigate to `/inbox`
- Verify thread list loads with existing data
- Verify escalation badges appear (if any messages have escalation data)
- Verify the "Approve & Send" button is sky-600 (not green)
- Verify the "Dismiss" button appears next to AI drafts

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve final typecheck/lint issues from inbox command center"
```
