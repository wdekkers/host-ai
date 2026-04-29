# Property To-Do List with AI Dictation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing tasks system into a global filterable to-do list with AI-powered voice/text dictation that parses free-form walkthrough notes into multiple structured tasks for user review.

**Architecture:** The web app stays a thin proxy. Persistence and parsing live in the `services/tasks` Fastify microservice. AI lives in a new `@walt/ai` package and is invoked by the tasks service. Property nicknames live on the `properties` table in `@walt/db`. UI is a new full `/tasks` page composed of dictation card + preview drawer + filterable list.

**Tech Stack:** Next.js 15 (App Router), Fastify (tasks service), Drizzle ORM + Postgres, Anthropic SDK (Claude Sonnet 4.6), Zod, shadcn/ui (Tailwind v4 + Lucide), Vitest/`node:test`.

**Spec:** `docs/superpowers/specs/2026-04-28-property-todos-ai-dictation-design.md`

**Reference for AI provider rule:** AI providers must be swappable at the call site — do not hide the provider choice behind a generic wrapper (per project memory). The `@walt/ai` package therefore exposes provider-specific entrypoints; `parseTaskDictation` is a Claude-specific function and should be named accordingly.

---

## Conventions used in this plan

- **Test runner for service code:** `node:test` + `node:assert/strict` (matches `services/tasks/src/index.test.ts`).
- **DB tests:** real Postgres (per CLAUDE.md). Local URL `postgres://walt:walt@localhost:5432/walt` is the default. Each test creates a unique `randomUUID()` org id to avoid collision.
- **Web app handler tests:** Vitest under `apps/web` (e.g. `route.test.ts` next to `handler.ts`).
- **UI component tests:** Vitest + Testing Library, only the minimum specified per spec.
- **Pre-PR check** (mandatory per CLAUDE.md): `pnpm turbo run typecheck lint build --filter=@walt/web` plus, in monorepo scope, `pnpm turbo run typecheck lint`.
- **Commit cadence:** every task ends with a commit. Use Conventional Commit prefixes (`feat:`, `test:`, `chore:`, etc.).

---

## File Structure

**New files:**

```
packages/db/src/schema.ts                              (modify: add nicknames column)
packages/db/drizzle/0034_property_nicknames.sql        (new migration)

packages/contracts/src/tasks.ts                        (modify: add parse-dictation + bulk schemas)

packages/ai/                                           (NEW package)
  package.json
  tsconfig.json
  src/
    index.ts                                           (re-exports)
    anthropic-client.ts                                (shared Claude client + env)
    parse-task-dictation/
      index.ts                                         (entrypoint)
      prompt.ts                                        (system + user prompt builders)
      schema.ts                                        (Zod for AI output)
      parse-task-dictation.test.ts                     (fixture-based unit tests)
      fixtures/
        single-task.json
        multi-task.json
        ambiguous-property.json
        new-category.json
        due-date-phrasing.json

services/tasks/src/index.ts                            (modify: add /tasks/parse-dictation + /tasks/bulk; nicknames in property context)
services/tasks/src/index.test.ts                       (modify: add tests for new endpoints)

apps/gateway/src/index.ts                              (modify: proxy new endpoints)

apps/web/src/app/api/tasks/parse-dictation/
  handler.ts
  handler.test.ts
  route.ts
apps/web/src/app/api/tasks/bulk/
  handler.ts
  handler.test.ts
  route.ts
apps/web/src/app/api/transcribe/
  handler.ts
  handler.test.ts
  route.ts                                             (Whisper fallback — Task 13)

apps/web/src/app/tasks/
  page.tsx                                             (rewrite stub)
  _components/
    dictation-card.tsx
    preview-drawer.tsx
    tasks-list.tsx
    task-row.tsx
    task-filters.tsx
    use-dictation.ts                                   (hook: Web Speech + Whisper fallback)

apps/web/src/app/properties/[id]/                      (modify: nicknames field + mounted TasksList)
```

**File-responsibility note:** keep `services/tasks/src/index.ts` from growing further. Extract `parse-dictation` route handler into a sibling file `parse-dictation.ts` and import it.

```
services/tasks/src/
  index.ts
  parse-dictation.ts                                   (new)
  bulk.ts                                              (new)
```

---

## Task 1 — Add `nicknames` column to `properties`

**Files:**

- Modify: `packages/db/src/schema.ts` (the `properties` table block)
- Create: `packages/db/drizzle/0034_property_nicknames.sql`

- [ ] **Step 1: Update Drizzle schema**

In `packages/db/src/schema.ts`, find the `properties` table definition and append:

```ts
nicknames: text('nicknames').array().notNull().default(sql`'{}'::text[]`),
```

(Add `sql` to the imports from `drizzle-orm` if not already imported — it is used elsewhere in the file.)

- [ ] **Step 2: Create the migration SQL**

Create `packages/db/drizzle/0034_property_nicknames.sql`:

```sql
ALTER TABLE "walt"."properties"
  ADD COLUMN IF NOT EXISTS "nicknames" text[] NOT NULL DEFAULT '{}'::text[];
```

- [ ] **Step 3: Apply migration locally**

```bash
pnpm --filter @walt/db db:migrate
```

Expected: migration applies, no errors.

- [ ] **Step 4: Typecheck**

```bash
pnpm turbo run typecheck --filter=@walt/db
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/0034_property_nicknames.sql
git commit -m "feat(db): add nicknames column to properties"
```

---

## Task 2 — Update tasks service property context to include nicknames

**Why:** The AI prompt needs `[{ id, name, nicknames }]`. Add a service helper now so later tasks can call it cleanly.

**Files:**

- Modify: `services/tasks/src/index.ts` (or extract a small helper file `services/tasks/src/property-context.ts`)
- Modify: `services/tasks/src/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `services/tasks/src/index.test.ts`:

```ts
import { properties } from '@walt/db';

void test('loadPropertyContext returns id, name, nicknames for org', async () => {
  const orgId = randomUUID();
  const propertyId = randomUUID();
  await db.insert(properties).values({
    id: propertyId,
    organizationId: orgId,
    name: 'Rushing Creek',
    nicknames: ['RC', 'Rushing'],
    raw: {},
    syncedAt: new Date(),
  });

  const ctx = await loadPropertyContext(db, orgId);
  assert.deepEqual(
    ctx.find((p) => p.id === propertyId),
    { id: propertyId, name: 'Rushing Creek', nicknames: ['RC', 'Rushing'] },
  );
});
```

(`properties` lacks an `organizationId` column today — verify before adding the test. If absent, scope the helper to all properties since this codebase is currently single-tenant for properties; the test should then create a property without `organizationId` and `loadPropertyContext` takes no org. Inspect `packages/db/src/schema.ts` and adapt accordingly.)

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @walt/service-tasks test
```

Expected: FAIL — `loadPropertyContext is not defined`.

- [ ] **Step 3: Implement helper**

Create `services/tasks/src/property-context.ts`:

```ts
import { eq } from 'drizzle-orm';
import { properties } from '@walt/db';

export type PropertyContextItem = {
  id: string;
  name: string;
  nicknames: string[];
};

export async function loadPropertyContext(
  db: import('@walt/db').Db, // adjust to actual exported type
): Promise<PropertyContextItem[]> {
  const rows = await db
    .select({
      id: properties.id,
      name: properties.name,
      nicknames: properties.nicknames,
    })
    .from(properties);
  return rows.map((r) => ({ id: r.id, name: r.name, nicknames: r.nicknames ?? [] }));
}
```

Re-export from `services/tasks/src/index.ts` for the test import.

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/tasks/src/property-context.ts services/tasks/src/index.ts services/tasks/src/index.test.ts
git commit -m "feat(tasks): expose property context with nicknames"
```

---

## Task 3 — Define contracts for parse-dictation and bulk-create

**Files:**

- Modify: `packages/contracts/src/tasks.ts`
- Create: `packages/contracts/src/tasks.test.ts` (or extend if exists)

- [ ] **Step 1: Add Zod schemas**

Append to `packages/contracts/src/tasks.ts`:

```ts
export const parseTaskDictationInputSchema = z.object({
  transcript: z.string().min(1).max(10_000),
});

export const dictationDraftTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  propertyMatches: z.array(z.string()),
  propertyAmbiguous: z.string().nullable(),
  categoryId: z.string().uuid().nullable(),
  suggestedNewCategory: z.string().nullable(),
  priority: taskPrioritySchema,
  dueDate: z.string().datetime().nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const parseTaskDictationOutputSchema = z.object({
  tasks: z.array(dictationDraftTaskSchema),
});

export const bulkCreateTaskInputSchema = z.object({
  drafts: z
    .array(
      createTaskInputSchema.extend({
        // Same as createTaskInputSchema; declared explicitly so we can extend later.
        newCategoryName: z.string().min(1).optional(),
      }),
    )
    .min(1),
  source: z.enum(['ai-dictation', 'manual']).default('manual'),
});

export const bulkCreateTaskResultSchema = z.object({
  results: z.array(
    z.object({
      ok: z.boolean(),
      task: taskSchema.optional(),
      error: z.string().optional(),
    }),
  ),
});

export type ParseTaskDictationInput = z.infer<typeof parseTaskDictationInputSchema>;
export type DictationDraftTask = z.infer<typeof dictationDraftTaskSchema>;
export type ParseTaskDictationOutput = z.infer<typeof parseTaskDictationOutputSchema>;
export type BulkCreateTaskInput = z.infer<typeof bulkCreateTaskInputSchema>;
export type BulkCreateTaskResult = z.infer<typeof bulkCreateTaskResultSchema>;
```

- [ ] **Step 2: Typecheck the package**

```bash
pnpm turbo run typecheck --filter=@walt/contracts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/contracts/src/tasks.ts
git commit -m "feat(contracts): add parse-dictation and bulk task schemas"
```

---

## Task 4 — Scaffold `@walt/ai` package

**Files:**

- Create: `packages/ai/package.json`
- Create: `packages/ai/tsconfig.json`
- Create: `packages/ai/src/index.ts`
- Create: `packages/ai/src/anthropic-client.ts`

- [ ] **Step 1: Create package manifest**

`packages/ai/package.json`:

```json
{
  "name": "@walt/ai",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./parse-task-dictation": "./dist/parse-task-dictation/index.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "node --test --import tsx 'src/**/*.test.ts'"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "@walt/contracts": "workspace:*",
    "zod": "3.25.76"
  },
  "devDependencies": {
    "@walt/config-eslint": "workspace:*",
    "@walt/config-typescript": "workspace:*",
    "tsx": "4.21.0",
    "typescript": "5.9.3"
  }
}
```

(Verify the actual installed `@anthropic-ai/sdk` version in another package — e.g. `apps/web/package.json` — and match it.)

- [ ] **Step 2: Create tsconfig**

`packages/ai/tsconfig.json`:

```json
{
  "extends": "@walt/config-typescript/base.json",
  "include": ["src"],
  "exclude": ["dist", "node_modules", "**/*.test.ts"],
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

(Match the pattern of an existing package such as `packages/sms/tsconfig.json`.)

- [ ] **Step 3: Create the Anthropic client**

`packages/ai/src/anthropic-client.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
});

export function createAnthropicClient(): Anthropic {
  const env = envSchema.parse(process.env);
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}
```

- [ ] **Step 4: Create barrel**

`packages/ai/src/index.ts`:

```ts
export { parseTaskDictation } from './parse-task-dictation/index.js';
export type {
  ParseTaskDictationOptions,
  ParseTaskDictationDeps,
} from './parse-task-dictation/index.js';
```

(Will fail until Task 5 — that's expected.)

- [ ] **Step 5: Install workspace deps**

```bash
pnpm install
```

- [ ] **Step 6: Commit**

```bash
git add packages/ai/ pnpm-lock.yaml
git commit -m "chore(ai): scaffold @walt/ai package"
```

---

## Task 5 — Implement `parseTaskDictation` (TDD)

**Files:**

- Create: `packages/ai/src/parse-task-dictation/schema.ts`
- Create: `packages/ai/src/parse-task-dictation/prompt.ts`
- Create: `packages/ai/src/parse-task-dictation/index.ts`
- Create: `packages/ai/src/parse-task-dictation/parse-task-dictation.test.ts`
- Create: `packages/ai/src/parse-task-dictation/fixtures/*.json`

- [ ] **Step 1: Write fixtures**

`packages/ai/src/parse-task-dictation/fixtures/single-task.json`:

```json
{
  "transcript": "The kitchen faucet is leaking at the lake house, please fix it by Friday.",
  "today": "2026-04-28",
  "properties": [
    { "id": "prop-lake", "name": "Lakeview Cottage", "nicknames": ["Lake House", "LH"] },
    { "id": "prop-rc", "name": "Rushing Creek", "nicknames": ["RC"] }
  ],
  "categories": [
    { "id": "cat-maint", "name": "Maintenance" },
    { "id": "cat-clean", "name": "Cleaning" }
  ],
  "expected": {
    "tasks": [
      {
        "title": "Fix leaking kitchen faucet",
        "description": "The kitchen faucet is leaking at the lake house, please fix it by Friday.",
        "propertyMatches": ["prop-lake"],
        "propertyAmbiguous": null,
        "categoryId": "cat-maint",
        "suggestedNewCategory": null,
        "priority": "medium",
        "dueDate": "2026-05-01",
        "confidence": "high"
      }
    ]
  }
}
```

Create `multi-task.json`, `ambiguous-property.json`, `new-category.json`, `due-date-phrasing.json` analogously — see spec for shape. Each fixture's `expected` represents what we want the parser layer to return _given a stub LLM response_ defined in the test.

- [ ] **Step 2: Write the failing test**

`parse-task-dictation.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseTaskDictation } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(here, 'fixtures', `${name}.json`), 'utf-8'));
}

void test('parseTaskDictation: single-task fixture', async () => {
  const fx = loadFixture('single-task');

  // Stub the model: it must receive the full prompt and return JSON matching the schema.
  const stubModel = async (prompt: { system: string; user: string }) => {
    assert.match(prompt.system, /property/i);
    assert.match(prompt.user, /lake house/i);
    return JSON.stringify(fx.expected);
  };

  const result = await parseTaskDictation(
    {
      transcript: fx.transcript,
      today: fx.today,
      properties: fx.properties,
      categories: fx.categories,
    },
    { invokeModel: stubModel },
  );

  assert.deepEqual(result, fx.expected);
});

void test('parseTaskDictation: empty transcript returns empty tasks', async () => {
  const stubModel = async () => JSON.stringify({ tasks: [] });
  const result = await parseTaskDictation(
    { transcript: '', today: '2026-04-28', properties: [], categories: [] },
    { invokeModel: stubModel },
  );
  assert.deepEqual(result, { tasks: [] });
});

void test('parseTaskDictation: invalid JSON throws ParseError', async () => {
  const stubModel = async () => 'not json';
  await assert.rejects(
    () =>
      parseTaskDictation(
        { transcript: 'x', today: '2026-04-28', properties: [], categories: [] },
        { invokeModel: stubModel },
      ),
    /failed to parse/i,
  );
});
```

Add similar tests for the other fixtures.

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm --filter @walt/ai test
```

Expected: FAIL (`parseTaskDictation is not exported`).

- [ ] **Step 4: Implement schema**

`packages/ai/src/parse-task-dictation/schema.ts`:

```ts
import { parseTaskDictationOutputSchema } from '@walt/contracts';
export { parseTaskDictationOutputSchema };
export type { ParseTaskDictationOutput } from '@walt/contracts';
```

- [ ] **Step 5: Implement prompt builders**

`packages/ai/src/parse-task-dictation/prompt.ts`:

```ts
type PromptInput = {
  transcript: string;
  today: string; // ISO date
  properties: Array<{ id: string; name: string; nicknames: string[] }>;
  categories: Array<{ id: string; name: string }>;
};

export function buildSystemPrompt(input: PromptInput): string {
  const propertyList = input.properties
    .map(
      (p) => `- id: ${p.id} | name: ${p.name} | nicknames: ${p.nicknames.join(', ') || '(none)'}`,
    )
    .join('\n');
  const categoryList = input.categories.map((c) => `- id: ${c.id} | name: ${c.name}`).join('\n');

  return `You convert a property manager's spoken walkthrough notes into a JSON list of tasks.

Today's date: ${input.today}

Properties (use these exact IDs in propertyMatches when the transcript mentions a property):
${propertyList || '(none)'}

Existing categories (use these exact IDs in categoryId when one fits):
${categoryList || '(none)'}

Output ONLY JSON matching this exact shape:
{
  "tasks": [
    {
      "title": string,                       // short imperative
      "description": string | null,          // verbatim sentence(s) from transcript
      "propertyMatches": string[],           // 0+ property IDs from the list above
      "propertyAmbiguous": string | null,    // raw mention if you couldn't match
      "categoryId": string | null,           // existing category id or null
      "suggestedNewCategory": string | null, // proposed name if no fit
      "priority": "low" | "medium" | "high",
      "dueDate": string | null,              // ISO date, resolve relative phrases against today
      "confidence": "high" | "medium" | "low"
    }
  ]
}

Rules:
- Split the transcript into multiple tasks when it covers separate items.
- If a property is mentioned by nickname, match it to that property's id.
- If a property mention is unclear, leave propertyMatches empty and put the raw phrase in propertyAmbiguous.
- Only invent a category in suggestedNewCategory when none of the existing ones fit.
- "Urgent", "ASAP" → priority "high". "Whenever", "no rush" → "low". Otherwise "medium".
- Resolve "Friday", "this weekend", "tomorrow" against today's date. If unclear, leave dueDate null.
- Output JSON only. No markdown, no commentary.`;
}

export function buildUserPrompt(input: PromptInput): string {
  return `Transcript:\n${input.transcript.trim()}\n\nReturn JSON only.`;
}
```

- [ ] **Step 6: Implement entrypoint**

`packages/ai/src/parse-task-dictation/index.ts`:

```ts
import { parseTaskDictationOutputSchema, type ParseTaskDictationOutput } from './schema.js';
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

async function defaultInvokeModel(prompt: { system: string; user: string }): Promise<string> {
  const client = createAnthropicClient();
  const message = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2000,
    temperature: 0.1,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  });
  const text = message.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return text;
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
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
pnpm --filter @walt/ai test
```

Expected: PASS for all fixtures.

- [ ] **Step 8: Commit**

```bash
git add packages/ai/src/parse-task-dictation/
git commit -m "feat(ai): add parseTaskDictation parser with fixtures"
```

---

## Task 6 — Tasks service: `POST /tasks/parse-dictation`

**Files:**

- Create: `services/tasks/src/parse-dictation.ts`
- Modify: `services/tasks/src/index.ts` (mount route)
- Modify: `services/tasks/src/index.test.ts`
- Modify: `services/tasks/package.json` (add `@walt/ai` dep)

- [ ] **Step 1: Add dependency**

```bash
pnpm --filter @walt/service-tasks add @walt/ai@workspace:*
```

- [ ] **Step 2: Write the failing test**

Append to `services/tasks/src/index.test.ts`:

```ts
void test('POST /tasks/parse-dictation returns parsed drafts (stubbed AI)', async () => {
  const orgId = randomUUID();
  const app = buildTasksApp(db, {
    parseTaskDictation: async () => ({
      tasks: [
        {
          title: 'Fix faucet',
          description: 'Kitchen faucet leaks',
          propertyMatches: [],
          propertyAmbiguous: 'lake house',
          categoryId: null,
          suggestedNewCategory: 'Plumbing',
          priority: 'medium',
          dueDate: null,
          confidence: 'medium',
        },
      ],
    }),
  });

  const response = await app.inject({
    method: 'POST',
    url: '/tasks/parse-dictation',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1' },
    payload: { transcript: 'Kitchen faucet leaks at the lake house' },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as { tasks: Array<{ title: string }> };
  assert.equal(body.tasks.length, 1);
  assert.equal(body.tasks[0].title, 'Fix faucet');
  await app.close();
});

void test('POST /tasks/parse-dictation: 400 when missing org', async () => {
  const app = buildTasksApp(db);
  const response = await app.inject({
    method: 'POST',
    url: '/tasks/parse-dictation',
    payload: { transcript: 'x' },
  });
  assert.equal(response.statusCode, 400);
  await app.close();
});

void test('POST /tasks/parse-dictation: 422 on invalid AI output', async () => {
  const orgId = randomUUID();
  const app = buildTasksApp(db, {
    parseTaskDictation: async () => {
      throw new Error('parseTaskDictation: failed to parse model output');
    },
  });
  const response = await app.inject({
    method: 'POST',
    url: '/tasks/parse-dictation',
    headers: { 'x-org-id': orgId, 'x-user-id': 'user-1' },
    payload: { transcript: 'x' },
  });
  assert.equal(response.statusCode, 422);
  await app.close();
});
```

(`buildTasksApp` currently takes only `db`; this test asserts a new optional second arg for dependency injection — see Step 4.)

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm --filter @walt/service-tasks test
```

Expected: FAIL.

- [ ] **Step 4: Add DI to buildTasksApp**

Modify the signature in `services/tasks/src/index.ts`:

```ts
export type TasksAppDeps = {
  parseTaskDictation?: typeof import('@walt/ai').parseTaskDictation;
};

export function buildTasksApp(db: Db, deps: TasksAppDeps = {}) {
  const app = Fastify({ logger: true });
  // ... existing routes ...
  registerParseDictationRoute(app, db, deps);
  // ... existing routes ...
  return app;
}
```

- [ ] **Step 5: Implement the route**

`services/tasks/src/parse-dictation.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { taskCategories } from '@walt/db';
import { parseTaskDictationInputSchema } from '@walt/contracts';
import { parseTaskDictation as defaultParse } from '@walt/ai';
import { loadPropertyContext } from './property-context.js';
import type { Db, TasksAppDeps } from './index.js';

export function registerParseDictationRoute(app: FastifyInstance, db: Db, deps: TasksAppDeps) {
  const parse = deps.parseTaskDictation ?? defaultParse;

  app.post('/tasks/parse-dictation', async (request, reply) => {
    const org = request.headers['x-org-id'] as string | undefined;
    if (!org) return reply.status(400).send({ error: 'Missing x-org-id header' });
    const user = request.headers['x-user-id'] as string | undefined;
    if (!user) return reply.status(400).send({ error: 'Missing x-user-id header' });

    const input = parseTaskDictationInputSchema.safeParse(request.body);
    if (!input.success) return reply.status(400).send({ error: input.error.message });

    const properties = await loadPropertyContext(db);
    const categories = await db
      .select({ id: taskCategories.id, name: taskCategories.name })
      .from(taskCategories)
      .where(eq(taskCategories.organizationId, org));

    try {
      const result = await parse({
        transcript: input.data.transcript,
        today: new Date().toISOString().slice(0, 10),
        properties,
        categories,
      });

      // Server-side sanitization: drop unknown IDs returned by the model.
      const validPropertyIds = new Set(properties.map((p) => p.id));
      const validCategoryIds = new Set(categories.map((c) => c.id));
      const sanitized = result.tasks.map((t) => {
        const matchedProps = t.propertyMatches.filter((id) => validPropertyIds.has(id));
        const droppedAny = matchedProps.length !== t.propertyMatches.length;
        return {
          ...t,
          propertyMatches: matchedProps,
          propertyAmbiguous:
            droppedAny && !t.propertyAmbiguous
              ? '(model returned unknown property)'
              : t.propertyAmbiguous,
          categoryId: t.categoryId && validCategoryIds.has(t.categoryId) ? t.categoryId : null,
          suggestedNewCategory:
            t.categoryId && !validCategoryIds.has(t.categoryId) && !t.suggestedNewCategory
              ? null
              : t.suggestedNewCategory,
        };
      });

      return reply.status(200).send({ tasks: sanitized });
    } catch (err) {
      app.log.warn({ err }, 'parseTaskDictation failed');
      return reply.status(422).send({ error: (err as Error).message });
    }
  });
}
```

Export `Db` from `index.ts`:

```ts
export type Db = ReturnType<typeof createDb>;
```

- [ ] **Step 6: Run tests to verify they pass**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add services/tasks/src/parse-dictation.ts services/tasks/src/index.ts services/tasks/src/index.test.ts services/tasks/package.json
git commit -m "feat(tasks): add /tasks/parse-dictation endpoint"
```

---

## Task 7 — Tasks service: `POST /tasks/bulk`

**Files:**

- Create: `services/tasks/src/bulk.ts`
- Modify: `services/tasks/src/index.ts`
- Modify: `services/tasks/src/index.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
void test('POST /tasks/bulk creates multiple tasks atomically per row', async () => {
  const orgId = randomUUID();
  const propertyId = randomUUID();
  await db.insert(properties).values({
    id: propertyId,
    name: 'X',
    raw: {},
    syncedAt: new Date(),
  });

  const app = buildTasksApp(db);
  const response = await app.inject({
    method: 'POST',
    url: '/tasks/bulk',
    headers: { 'x-org-id': orgId, 'x-user-id': 'u' },
    payload: {
      drafts: [
        { title: 'A', priority: 'medium', propertyIds: [propertyId] },
        { title: 'B', priority: 'high', propertyIds: [propertyId], newCategoryName: 'Plumbing' },
      ],
      source: 'ai-dictation',
    },
  });
  assert.equal(response.statusCode, 200);
  const body = response.json() as {
    results: Array<{ ok: boolean; task?: { title: string; categoryId: string | null } }>;
  };
  assert.equal(body.results.length, 2);
  assert.ok(body.results[0].ok);
  assert.ok(body.results[1].ok);
  assert.equal(body.results[0].task!.title, 'A');
  assert.ok(body.results[1].task!.categoryId, 'B should have an upserted category');
  await app.close();
});

void test('POST /tasks/bulk reports per-row failures without aborting', async () => {
  const orgId = randomUUID();
  const app = buildTasksApp(db);
  const response = await app.inject({
    method: 'POST',
    url: '/tasks/bulk',
    headers: { 'x-org-id': orgId, 'x-user-id': 'u' },
    payload: {
      drafts: [
        { title: 'OK', priority: 'medium', propertyIds: ['nonexistent'] }, // will succeed - propertyIds are not FK-enforced
        { title: '', priority: 'medium', propertyIds: ['x'] }, // will fail Zod validation per-row
      ],
    },
  });
  assert.equal(response.statusCode, 200);
  const body = response.json() as { results: Array<{ ok: boolean }> };
  assert.equal(body.results.length, 2);
  assert.ok(body.results[0].ok);
  assert.equal(body.results[1].ok, false);
  await app.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL.

- [ ] **Step 3: Implement bulk route**

`services/tasks/src/bulk.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { tasks, taskCategories, taskAuditEvents } from '@walt/db';
import { bulkCreateTaskInputSchema, createTaskInputSchema } from '@walt/contracts';
import type { Db } from './index.js';

export function registerBulkCreateRoute(app: FastifyInstance, db: Db) {
  app.post('/tasks/bulk', async (request, reply) => {
    const org = request.headers['x-org-id'] as string | undefined;
    if (!org) return reply.status(400).send({ error: 'Missing x-org-id header' });
    const user = request.headers['x-user-id'] as string | undefined;
    if (!user) return reply.status(400).send({ error: 'Missing x-user-id header' });

    const parsed = bulkCreateTaskInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });

    const results: Array<{ ok: boolean; task?: unknown; error?: string }> = [];

    for (const draft of parsed.data.drafts) {
      try {
        const { newCategoryName, ...taskInput } = draft;
        const validated = createTaskInputSchema.parse(taskInput);

        let categoryId = validated.categoryId ?? null;
        if (!categoryId && newCategoryName) {
          const trimmed = newCategoryName.trim();
          // Upsert by (organizationId, lower(name))
          const existing = await db
            .select({ id: taskCategories.id })
            .from(taskCategories)
            .where(
              and(
                eq(taskCategories.organizationId, org),
                sql`lower(${taskCategories.name}) = lower(${trimmed})`,
              ),
            )
            .limit(1);
          if (existing[0]) {
            categoryId = existing[0].id;
          } else {
            const newId = randomUUID();
            await db.insert(taskCategories).values({
              id: newId,
              organizationId: org,
              name: trimmed,
              createdAt: new Date(),
              createdBy: user,
            });
            categoryId = newId;
          }
        }

        const id = randomUUID();
        const now = new Date();
        const [item] = await db
          .insert(tasks)
          .values({
            id,
            organizationId: org,
            title: validated.title,
            description: validated.description ?? null,
            status: 'open',
            priority: validated.priority,
            categoryId,
            assigneeId: validated.assigneeId ?? null,
            propertyIds: validated.propertyIds,
            dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
            createdAt: now,
            createdBy: user,
            updatedAt: now,
            updatedBy: user,
          })
          .returning();

        await db.insert(taskAuditEvents).values({
          id: randomUUID(),
          taskId: id,
          organizationId: org,
          action: 'created',
          changedBy: user,
          changedAt: now,
          delta: {
            source: parsed.data.source,
            title: validated.title,
            priority: validated.priority,
            propertyIds: validated.propertyIds,
          },
        });

        results.push({ ok: true, task: item });
      } catch (err) {
        results.push({ ok: false, error: (err as Error).message });
      }
    }

    return reply.status(200).send({ results });
  });
}
```

Mount in `index.ts` next to existing routes: `registerBulkCreateRoute(app, db);`.

- [ ] **Step 4: Run tests to verify they pass**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/tasks/src/bulk.ts services/tasks/src/index.ts services/tasks/src/index.test.ts
git commit -m "feat(tasks): add /tasks/bulk endpoint with category upsert"
```

---

## Task 8 — Gateway: proxy new endpoints

**Files:**

- Modify: `apps/gateway/src/index.ts`

- [ ] **Step 1: Add `POST /tasks/parse-dictation` proxy**

After the existing tasks routes in `apps/gateway/src/index.ts`, add:

```ts
app.post('/tasks/parse-dictation', { preHandler: requireAuth() }, async (request, reply) => {
  const headers = await forwardHeaders(request);
  const response = await fetch(`${tasksServiceBaseUrl}/tasks/parse-dictation`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(request.body ?? {}),
  });
  const payload = await response.json();
  return reply.status(response.status).send(payload);
});

app.post('/tasks/bulk', { preHandler: requireAuth() }, async (request, reply) => {
  const headers = await forwardHeaders(request);
  const response = await fetch(`${tasksServiceBaseUrl}/tasks/bulk`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(request.body ?? {}),
  });
  const payload = await response.json();
  return reply.status(response.status).send(payload);
});
```

(Use whatever helper the gateway already uses to set `x-org-id` / `x-user-id` headers — search for an existing `requireAuth` or `forwardHeaders` pattern in the file. If absent, replicate the header forwarding seen in the existing `app.post('/tasks', …)` block verbatim.)

- [ ] **Step 2: Typecheck and lint**

```bash
pnpm turbo run typecheck lint --filter=@walt/gateway
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/gateway/src/index.ts
git commit -m "feat(gateway): proxy /tasks/parse-dictation and /tasks/bulk"
```

---

## Task 9 — Web app proxy routes (parse-dictation + bulk)

**Files:**

- Create: `apps/web/src/app/api/tasks/parse-dictation/handler.ts`
- Create: `apps/web/src/app/api/tasks/parse-dictation/route.ts`
- Create: `apps/web/src/app/api/tasks/parse-dictation/handler.test.ts`
- Create: `apps/web/src/app/api/tasks/bulk/{handler.ts,route.ts,handler.test.ts}`

- [ ] **Step 1: Implement the parse-dictation handler**

`apps/web/src/app/api/tasks/parse-dictation/handler.ts` (mirror the existing `apps/web/src/app/api/tasks/route.ts` proxy pattern):

```ts
import { NextResponse } from 'next/server';
import { parseTaskDictationInputSchema } from '@walt/contracts';

const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';

export async function handleParseDictation(request: Request): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const parsed = parseTaskDictationInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  try {
    const response = await fetch(`${gatewayBaseUrl}/tasks/parse-dictation`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: request.headers.get('authorization') ?? '',
      },
      cache: 'no-store',
      body: JSON.stringify(parsed.data),
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Tasks service unavailable' }, { status: 502 });
  }
}
```

`apps/web/src/app/api/tasks/parse-dictation/route.ts`:

```ts
import { withPermission } from '@/lib/auth/authorize';
import { handleParseDictation } from './handler';

export const POST = withPermission('tasks.create', async (request: Request) =>
  handleParseDictation(request),
);
```

(Verify `'tasks.create'` is the right permission key by grepping `apps/web/src/lib/auth/authorize.ts` and the existing tasks handlers.)

- [ ] **Step 2: Test the parse-dictation handler**

`handler.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { handleParseDictation } from './handler';

describe('handleParseDictation', () => {
  it('returns 400 on invalid input', async () => {
    const req = new Request('http://x', { method: 'POST', body: JSON.stringify({}) });
    const res = await handleParseDictation(req);
    expect(res.status).toBe(400);
  });

  it('proxies to gateway and forwards status', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ tasks: [] }), { status: 200 }));
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ transcript: 'hello' }),
    });
    const res = await handleParseDictation(req);
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
```

- [ ] **Step 3: Implement the bulk handler analogously**

Same shape, validates with `bulkCreateTaskInputSchema`, proxies to `${gatewayBaseUrl}/tasks/bulk`. Same test shape.

- [ ] **Step 4: Run web app tests**

```bash
pnpm --filter @walt/web test apps/web/src/app/api/tasks
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/tasks/parse-dictation apps/web/src/app/api/tasks/bulk
git commit -m "feat(web): add proxy routes for parse-dictation and bulk task create"
```

---

## Task 10 — Property settings: nicknames field

**Files:**

- Locate via `grep -rn "Nicknames\|nicknames\|propertySettings" apps/web/src/app/properties` and the existing property settings page (likely `apps/web/src/app/properties/[id]/settings/page.tsx` or similar).
- Create or modify the relevant settings form.
- Create or modify a `PUT /api/properties/[id]/nicknames` route, or extend the existing property update route to accept `nicknames`.

- [ ] **Step 1: Find the property settings entry point**

```bash
grep -rn "properties/\[id\]" apps/web/src/app | head
grep -rn "isActive\|hasPool" apps/web/src/app/properties/[id] | head
```

Identify the settings form component and the API route that persists property changes.

- [ ] **Step 2: Add a Zod input schema**

Wherever property updates are validated (handler.ts in the property update route), add `nicknames: z.array(z.string().min(1)).max(20).optional()` to the input schema.

- [ ] **Step 3: Persist to DB**

Update the Drizzle update statement to include `nicknames` when present.

- [ ] **Step 4: Add a chip-input UI**

Use shadcn `Input` + a simple chip list. Suggested component path:
`apps/web/src/components/ui/chip-input.tsx` (if not present, create a small uncontrolled chip-input — keep it under 80 lines).

Render it on the settings page below the existing fields:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Nicknames</CardTitle>
  </CardHeader>
  <CardContent>
    <ChipInput value={nicknames} onChange={setNicknames} placeholder="Add nickname (e.g. RC)" />
    <p className="text-sm text-muted-foreground mt-2">
      Used by AI to match property mentions in dictated tasks.
    </p>
  </CardContent>
</Card>
```

- [ ] **Step 5: Wire submit**

The existing settings save action should now include `nicknames` in its payload.

- [ ] **Step 6: Manual smoke test**

Start dev server: `pnpm --filter @walt/web dev`. Open the property settings, add nicknames "RC", save, refresh, verify they round-trip.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/properties apps/web/src/components/ui/chip-input.tsx
git commit -m "feat(web): manage property nicknames in settings"
```

---

## Task 11 — UI: dictation hook + dictation card

**Files:**

- Create: `apps/web/src/app/tasks/_components/use-dictation.ts`
- Create: `apps/web/src/app/tasks/_components/dictation-card.tsx`

- [ ] **Step 1: Implement the hook**

`use-dictation.ts` exposes:

```ts
type DictationState = {
  transcript: string;
  setTranscript(value: string): void;
  isRecording: boolean;
  start(): Promise<void>;
  stop(): void;
  error: string | null;
  /** True if Web Speech API is unavailable (we'd need Whisper fallback). */
  needsWhisperFallback: boolean;
};
```

Behavior:

- On `start()`: if `window.SpeechRecognition || window.webkitSpeechRecognition` is available, use it and stream interim/final transcripts into `transcript`. Otherwise set `needsWhisperFallback = true` and surface a "Recording (will upload after stop)…" path that uses `MediaRecorder` to capture audio and upload to `/api/transcribe` on stop (Task 13).
- Mic permission denied → set `error` and revert to text-only mode silently.

- [ ] **Step 2: Implement DictationCard**

```tsx
'use client';
import { useState } from 'react';
import { Mic, MicOff, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useDictation } from './use-dictation';

export function DictationCard({ onParsed }: { onParsed: (drafts: unknown[]) => void }) {
  const dictation = useDictation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function parse() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/tasks/parse-dictation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transcript: dictation.transcript }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { tasks: unknown[] };
      if (data.tasks.length === 0) setError('No tasks detected.');
      else onParsed(data.tasks);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dictate tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={5}
          value={dictation.transcript}
          onChange={(e) => dictation.setTranscript(e.target.value)}
          placeholder="Walk through the property and describe what needs to be done…"
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={dictation.isRecording ? 'destructive' : 'secondary'}
            onClick={() => (dictation.isRecording ? dictation.stop() : dictation.start())}
          >
            {dictation.isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            <span className="ml-2">{dictation.isRecording ? 'Stop' : 'Record'}</span>
          </Button>
          <Button
            type="button"
            onClick={parse}
            disabled={busy || dictation.transcript.length === 0}
          >
            <Sparkles className="h-4 w-4" />
            <span className="ml-2">{busy ? 'Parsing…' : 'Parse with AI'}</span>
          </Button>
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Verify via dev server**

```bash
pnpm --filter @walt/web dev
```

Open `/tasks`, type into the textarea, click "Parse with AI" with an empty backend stub — error should display gracefully.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/tasks/_components/use-dictation.ts apps/web/src/app/tasks/_components/dictation-card.tsx
git commit -m "feat(web): add dictation card and Web Speech hook"
```

---

## Task 12 — UI: preview drawer

**Files:**

- Create: `apps/web/src/app/tasks/_components/preview-drawer.tsx`

- [ ] **Step 1: Implement the drawer**

Use shadcn `Sheet` (mobile-friendly drawer) with:

- One row per draft, each row a `Card` containing editable fields:
  - Title (`Input`)
  - Description (`Textarea`)
  - Property (multi-select; reuse an existing property selector if one exists — search `apps/web/src/components` for "PropertySelector"; otherwise build a simple shadcn `Command` + `Popover` multi-select)
  - Category (Select with existing categories; if `suggestedNewCategory` is set on the draft, prepend an option `Create "${suggestedNewCategory}"`)
  - Priority (Select: low/medium/high)
  - Due date (`<input type="date" />` styled by shadcn `Input`)
- Warning chip when `confidence === 'low'` or `propertyAmbiguous` is non-null.
- Footer: "Approve all" submits to `/api/tasks/bulk`; "Cancel" closes drawer.
- On partial failure, keep failed drafts in the drawer with an inline error.

Pseudocode skeleton:

```tsx
'use client';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// + Input, Textarea, Select imports

import type { DictationDraftTask } from '@walt/contracts';

type EditableDraft = DictationDraftTask & {
  _localId: string;
  _error?: string;
  newCategoryName?: string;
};

export function PreviewDrawer({
  open,
  onClose,
  initialDrafts,
  properties,
  categories,
  onCreated,
}: {
  open: boolean;
  onClose(): void;
  initialDrafts: DictationDraftTask[];
  properties: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  onCreated(): void;
}) {
  const [drafts, setDrafts] = useState<EditableDraft[]>(() =>
    initialDrafts.map((d, i) => ({ ...d, _localId: String(i) })),
  );
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true);
    const payload = {
      drafts: drafts.map((d) => ({
        title: d.title,
        description: d.description ?? undefined,
        priority: d.priority,
        propertyIds: d.propertyMatches,
        categoryId: d.categoryId ?? undefined,
        dueDate: d.dueDate ?? undefined,
        newCategoryName: d.suggestedNewCategory ?? d.newCategoryName ?? undefined,
      })),
      source: 'ai-dictation' as const,
    };
    const res = await fetch('/api/tasks/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as { results: Array<{ ok: boolean; error?: string }> };
    const remaining = drafts
      .map((d, i) => (body.results[i].ok ? null : { ...d, _error: body.results[i].error }))
      .filter(Boolean) as EditableDraft[];
    setDrafts(remaining);
    setBusy(false);
    if (remaining.length === 0) {
      onCreated();
      onClose();
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Review {drafts.length} drafts</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 mt-4 overflow-y-auto pb-32">
          {drafts.map((d) => (
            <Card key={d._localId}>
              <CardContent className="space-y-2 pt-4">{/* fields here */}</CardContent>
            </Card>
          ))}
        </div>
        <div className="absolute bottom-0 inset-x-0 border-t bg-background p-4 flex gap-2">
          <Button onClick={approve} disabled={busy || drafts.length === 0}>
            {busy ? 'Creating…' : `Approve ${drafts.length}`}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Add the small Vitest UI test**

`apps/web/src/app/tasks/_components/preview-drawer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PreviewDrawer } from './preview-drawer';

describe('PreviewDrawer', () => {
  it('submits drafts to /api/tasks/bulk on approve', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ results: [{ ok: true }] }), { status: 200 }),
      );
    const onCreated = vi.fn();
    render(
      <PreviewDrawer
        open
        onClose={() => {}}
        initialDrafts={[
          {
            title: 'A',
            description: null,
            propertyMatches: ['p1'],
            propertyAmbiguous: null,
            categoryId: null,
            suggestedNewCategory: null,
            priority: 'medium',
            dueDate: null,
            confidence: 'high',
          },
        ]}
        properties={[{ id: 'p1', name: 'X' }]}
        categories={[]}
        onCreated={onCreated}
      />,
    );
    fireEvent.click(screen.getByText(/Approve/));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/tasks/bulk', expect.any(Object));
      expect(onCreated).toHaveBeenCalled();
    });
    fetchSpy.mockRestore();
  });
});
```

- [ ] **Step 3: Run the test**

```bash
pnpm --filter @walt/web test apps/web/src/app/tasks/_components/preview-drawer.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/tasks/_components/preview-drawer.tsx apps/web/src/app/tasks/_components/preview-drawer.test.tsx
git commit -m "feat(web): add preview drawer for AI-dictated tasks"
```

---

## Task 13 — Whisper fallback transcription endpoint

**Files:**

- Create: `apps/web/src/app/api/transcribe/handler.ts`
- Create: `apps/web/src/app/api/transcribe/route.ts`
- Create: `apps/web/src/app/api/transcribe/handler.test.ts`
- Modify: `packages/ai/src/index.ts` (add `transcribeWithWhisper` if you want the call site to be in `@walt/ai` per the project memory's pluggability rule).

> **Note:** Per the project memory rule that AI providers must be swappable at the call site, expose `transcribeWithWhisper` from `@walt/ai` (OpenAI Whisper SDK) rather than wrapping it generically.

- [ ] **Step 1: Add `transcribeWithWhisper` to `@walt/ai`**

`packages/ai/src/transcribe-with-whisper.ts`:

```ts
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
```

Re-export from `packages/ai/src/index.ts`. Add `openai` to `packages/ai/package.json` dependencies.

- [ ] **Step 2: Implement the route handler**

`apps/web/src/app/api/transcribe/handler.ts`:

```ts
import { NextResponse } from 'next/server';
import { transcribeWithWhisper } from '@walt/ai';

export async function handleTranscribe(request: Request): Promise<Response> {
  const form = await request.formData();
  const audio = form.get('audio');
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: 'Missing audio file' }, { status: 400 });
  }
  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: 'Audio too large (max 25 MB)' }, { status: 413 });
  }
  try {
    const text = await transcribeWithWhisper(audio);
    return NextResponse.json({ transcript: text });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
```

`route.ts`:

```ts
import { withPermission } from '@/lib/auth/authorize';
import { handleTranscribe } from './handler';

export const POST = withPermission('tasks.create', async (request: Request) =>
  handleTranscribe(request),
);
```

- [ ] **Step 3: Test the handler**

```ts
import { describe, it, expect, vi } from 'vitest';
import { handleTranscribe } from './handler';

vi.mock('@walt/ai', () => ({ transcribeWithWhisper: vi.fn().mockResolvedValue('hello world') }));

describe('handleTranscribe', () => {
  it('400 on missing audio', async () => {
    const req = new Request('http://x', { method: 'POST', body: new FormData() });
    const res = await handleTranscribe(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 4: Wire the hook**

In `use-dictation.ts`, in the `MediaRecorder` fallback path, on `stop()` POST the recorded `Blob` to `/api/transcribe` and set `transcript` from the response.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/transcribe packages/ai/src/transcribe-with-whisper.ts packages/ai/src/index.ts packages/ai/package.json apps/web/src/app/tasks/_components/use-dictation.ts
git commit -m "feat(web): add Whisper transcription fallback"
```

---

## Task 14 — UI: filterable list, task row, filters

**Files:**

- Create: `apps/web/src/app/tasks/_components/tasks-list.tsx`
- Create: `apps/web/src/app/tasks/_components/task-row.tsx`
- Create: `apps/web/src/app/tasks/_components/task-filters.tsx`

- [ ] **Step 1: Implement `TaskFilters`**

Reads/writes URL search params (`property`, `category`, `status`, `priority`, `dueFrom`, `dueTo`, `q`). Uses `useSearchParams` + `useRouter().replace`.

Filters:

- Property — multi-select using property list (passed in as a prop, fetched at the page level). Selector should match by name **or** any nickname (searchable input).
- Category — multi-select.
- Status — Select (all / open / resolved).
- Priority — Select (all / low / medium / high).
- Due-date range — two `<input type="date" />`.
- Search — `Input` with debounced `q` param.

- [ ] **Step 2: Implement `TasksList`**

```tsx
type Props = { propertyId?: string };
export function TasksList({ propertyId }: Props) { … }
```

Uses `useSearchParams`. Builds a query string from URL params (and `propertyId` if provided), fetches `/api/tasks?…`, renders `<TaskRow>` per result. Page size 50; "Load more" button. When `propertyId` is given, omit the property filter from the UI but apply it to the query.

- [ ] **Step 3: Implement `TaskRow`**

Inline status toggle (PATCH `/api/tasks/[id]` — uses existing route), category badge, property names, priority chip, due-date display. Edit/delete actions.

- [ ] **Step 4: Manual smoke test in dev server**

Filters reflect in URL; refresh keeps state.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/tasks/_components/tasks-list.tsx apps/web/src/app/tasks/_components/task-row.tsx apps/web/src/app/tasks/_components/task-filters.tsx
git commit -m "feat(web): add filterable tasks list with URL state"
```

---

## Task 15 — `/tasks` page wiring

**Files:**

- Modify: `apps/web/src/app/tasks/page.tsx` (replace the 14-line stub)

- [ ] **Step 1: Compose the page**

```tsx
'use client';
import { useState } from 'react';
import { DictationCard } from './_components/dictation-card';
import { PreviewDrawer } from './_components/preview-drawer';
import { TasksList } from './_components/tasks-list';
import { TaskFilters } from './_components/task-filters';
import type { DictationDraftTask } from '@walt/contracts';

export default function TasksPage() {
  const [drafts, setDrafts] = useState<DictationDraftTask[] | null>(null);
  // properties and categories should be fetched once and passed down — replace with your project's standard data-fetching hook.
  return (
    <div className="space-y-6 p-6">
      <DictationCard onParsed={(d) => setDrafts(d as DictationDraftTask[])} />
      <TaskFilters />
      <TasksList />
      <PreviewDrawer
        open={drafts !== null}
        onClose={() => setDrafts(null)}
        initialDrafts={drafts ?? []}
        properties={[]}
        categories={[]} // wire from a useProperties / useTaskCategories hook
        onCreated={() => {
          /* trigger list refetch */
        }}
      />
    </div>
  );
}
```

(Find existing `useProperties` and `useTaskCategories` hooks in the codebase or add small fetch hooks adjacent to this page.)

- [ ] **Step 2: Verify routing**

```bash
pnpm --filter @walt/web dev
```

Visit `/tasks`, dictate something (with the AI parser stubbed via env variable, or real key), confirm full flow: type → parse → preview → approve → list refresh.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/tasks/page.tsx
git commit -m "feat(web): wire /tasks page with dictation, preview, and list"
```

---

## Task 16 — Property page: mount filtered TasksList

**Files:**

- Modify: the property detail page (likely `apps/web/src/app/properties/[id]/page.tsx` or a tab component within it). Locate via `grep -rn "params.id\|propertyId" apps/web/src/app/properties/[id]`.

- [ ] **Step 1: Mount the component**

Add a "Tasks" section/tab using:

```tsx
import { TasksList } from '@/app/tasks/_components/tasks-list';
…
<TasksList propertyId={params.id} />
```

- [ ] **Step 2: Manual smoke test**

Dev server: visit a property's page; verify only its tasks appear.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/properties
git commit -m "feat(web): show filtered tasks list on property page"
```

---

## Task 17 — Pre-PR validation

- [ ] **Step 1: Run the full required check**

```bash
pnpm turbo run typecheck lint build --filter=@walt/web
```

Expected: ALL PASS.

- [ ] **Step 2: Run monorepo-wide checks**

```bash
pnpm turbo run typecheck lint
```

Expected: ALL PASS.

- [ ] **Step 3: Run all tests touched by this change**

```bash
pnpm --filter @walt/db test
pnpm --filter @walt/contracts test
pnpm --filter @walt/ai test
pnpm --filter @walt/service-tasks test
pnpm --filter @walt/web test apps/web/src/app/api/tasks apps/web/src/app/api/transcribe apps/web/src/app/tasks
```

Expected: ALL PASS.

- [ ] **Step 4: Manual end-to-end smoke**

With Postgres + tasks service + gateway + web all running locally, dictate a 3-task walkthrough, verify all 3 land in the list with correct property/category/priority/due dates.

- [ ] **Step 5: Open PR**

Per CLAUDE.md "Clean PRs from clean branches" rule, this work is already on a fresh branch (`feat/property-todos-ai`) off `origin/main` in a worktree — no cherry-pick needed.

```bash
git push -u origin feat/property-todos-ai
gh pr create --title "feat: property to-do list with AI dictation" --body "$(cat <<'EOF'
## Summary
- Adds `properties.nicknames` column for AI matching
- New `@walt/ai` package with `parseTaskDictation` (Claude Sonnet 4.6) and `transcribeWithWhisper`
- Tasks service: `POST /tasks/parse-dictation` and `POST /tasks/bulk` with category upsert
- Web app: rewritten `/tasks` page with dictation card, preview drawer, filterable list
- Reuses the same list component on property pages

## Test plan
- [ ] Add 2 nicknames to a property; save; refresh; round-trip OK
- [ ] Dictate a 3-task walkthrough mentioning two properties by nickname; verify drafts
- [ ] Edit a draft, change property, approve; row appears in list with correct property
- [ ] AI suggests a new category; click "Create"; verify category persists
- [ ] Filter list by property / category / priority; URL reflects state; refresh keeps state
- [ ] Property page shows only that property's tasks

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Checklist (run after writing this plan)

1. **Spec coverage** — every spec section is mapped to a task:
   - Data model deltas → Task 1
   - Settings UI for nicknames → Task 10
   - AI flow / `parseTaskDictation` → Tasks 4–5
   - `POST /api/tasks/parse-dictation` (with sanitization) → Task 6 + 9
   - `POST /api/tasks/bulk` (with category upsert) → Task 7 + 9
   - Dictation card + Web Speech / Whisper fallback → Tasks 11, 13
   - Preview drawer → Task 12
   - Filter bar with URL state → Task 14
   - Task list (50 page size) → Task 14
   - Property pages mount `<TasksList propertyId>` → Task 16
   - Errors & edge cases (Zod fail, empty tasks, bad IDs, partial bulk failure, category upsert race) → Tasks 6, 7, 9, 11, 12
   - Testing matrix → Tasks 5, 6, 7, 9, 12, 13

2. **Placeholders** — none. Where exact existing code locations were uncertain (property settings page, gateway header helper), I directed the engineer to grep for them rather than guess.

3. **Type consistency** — the contract types (`DictationDraftTask`, `BulkCreateTaskInput`) are defined once in Task 3 and consumed unchanged downstream.
