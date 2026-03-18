# StayInFrisco SEO Draft Pipeline MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an MVP pipeline in this repo that discovers Frisco event opportunities and generates ready-to-publish SEO page drafts for `StayInFrisco.com`, with human approval required before anything goes live.

**Architecture:** Keep the MVP inside `apps/web` and `packages/db`; do not create a new microservice yet. A manual `POST` trigger runs a linear pipeline (`event scout -> opportunity scorer -> draft generator -> review worker`) against a curated list of Frisco event sources, persists artifacts to Postgres, and exposes a review queue in the Next.js app. Publication to the separate StayInFrisco service is explicitly out of scope for this phase.

**Tech Stack:** Next.js App Router route handlers and server components, Drizzle ORM/Postgres via `@walt/db`, Zod contracts via `@walt/contracts`, OpenAI SDK for extraction/generation, Node test runner via `tsx --test`.

---

## Scope Guardrails

- Market scope: `frisco-tx` only.
- Site scope: `stayinfrisco` only.
- Run mode: manual trigger only.
- Output: stored draft package plus approval queue.
- No CMS publishing, analytics ingestion, Search Console ingestion, or auto-refresh loop in MVP.
- Use a curated source list in code for MVP; do not build source-management UI yet.

### Task 1: Add SEO pipeline contracts and permission mapping

**Files:**

- Create: `packages/contracts/src/seo.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/web/src/lib/auth/permissions.ts`
- Test: `apps/web/src/lib/auth/permissions.test.ts`

**Step 1: Create SEO pipeline schemas**

Create `packages/contracts/src/seo.ts`:

```ts
import { z } from 'zod';

export const marketKeySchema = z.enum(['frisco-tx']);
export const siteKeySchema = z.enum(['stayinfrisco']);
export const seoRunStatusSchema = z.enum(['running', 'completed', 'partial', 'failed']);
export const seoCandidateStatusSchema = z.enum(['discovered', 'discarded', 'promoted']);
export const seoOpportunityStatusSchema = z.enum(['queued', 'drafted', 'skipped']);
export const seoDraftStatusSchema = z.enum([
  'generated',
  'needs_review',
  'approved',
  'rejected',
  'needs_attention',
]);

export const seoEventCandidateSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  marketKey: marketKeySchema,
  sourceId: z.string().min(1),
  sourceUrl: z.string().url(),
  title: z.string().min(1),
  venueName: z.string().nullish(),
  city: z.string().nullish(),
  startsAt: z.string().nullish(),
  endsAt: z.string().nullish(),
  summary: z.string().nullish(),
  sourceSnippet: z.string().nullish(),
  normalizedHash: z.string().min(1),
  status: seoCandidateStatusSchema,
  discoveredAt: z.string(),
});

export const seoOpportunitySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  candidateId: z.string().uuid(),
  marketKey: marketKeySchema,
  siteKey: siteKeySchema,
  targetKeyword: z.string().min(1),
  targetSlug: z.string().min(1),
  travelerIntent: z.string().min(1),
  propertyIds: z.array(z.string()).min(1),
  score: z.number().int().min(0).max(100),
  reasons: z.array(z.string()).min(1),
  status: seoOpportunityStatusSchema,
  evaluatedAt: z.string(),
});

export const seoDraftSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  opportunityId: z.string().uuid(),
  siteKey: siteKeySchema,
  marketKey: marketKeySchema,
  titleTag: z.string().min(1),
  metaDescription: z.string().min(1),
  slug: z.string().min(1),
  h1: z.string().min(1),
  outline: z.array(z.string()).min(3),
  bodyMarkdown: z.string().min(1),
  faqItems: z.array(
    z.object({
      question: z.string().min(1),
      answer: z.string().min(1),
    }),
  ),
  ctaText: z.string().min(1),
  internalLinks: z.array(
    z.object({
      href: z.string().min(1),
      anchor: z.string().min(1),
    }),
  ),
  sourceUrls: z.array(z.string().url()).min(1),
  reviewNotes: z.array(z.string()).default([]),
  status: seoDraftStatusSchema,
  generatedAt: z.string(),
  reviewedAt: z.string().nullish(),
});

export const runSeoPipelineInputSchema = z.object({
  marketKey: marketKeySchema.default('frisco-tx'),
  siteKey: siteKeySchema.default('stayinfrisco'),
  maxCandidates: z.coerce.number().int().min(1).max(25).default(10),
});

export const reviewSeoDraftInputSchema = z.object({
  action: z.enum(['approve', 'reject', 'needs_attention']),
  note: z.string().trim().max(500).optional(),
});

export type SeoDraft = z.infer<typeof seoDraftSchema>;
export type RunSeoPipelineInput = z.infer<typeof runSeoPipelineInputSchema>;
```

**Step 2: Export the new contracts**

Modify `packages/contracts/src/index.ts`:

```ts
export * from './seo.js';
```

**Step 3: Route the new API namespace through `drafts.write`**

Update `apps/web/src/lib/auth/permissions.ts` so these paths map correctly:

```ts
if (pathname.includes('/command-center/seo-drafts')) {
  return method === 'GET' ? 'dashboard.read' : 'drafts.write';
}
```

**Step 4: Add permission tests**

Add to `apps/web/src/lib/auth/permissions.test.ts`:

```ts
assert.equal(
  getPermissionForApiRoute('/api/command-center/seo-drafts', 'GET'),
  'dashboard.read',
);
assert.equal(
  getPermissionForApiRoute('/api/command-center/seo-drafts/run', 'POST'),
  'drafts.write',
);
assert.equal(
  getPermissionForApiRoute('/api/command-center/seo-drafts/draft-1', 'PATCH'),
  'drafts.write',
);
```

**Step 5: Run the focused contract/permission tests**

Run:

```bash
pnpm --filter @walt/web test
```

Expected: `permissions.test.ts` passes with the new route mapping.

**Step 6: Commit**

```bash
git add packages/contracts/src/seo.ts packages/contracts/src/index.ts apps/web/src/lib/auth/permissions.ts apps/web/src/lib/auth/permissions.test.ts
git commit -m "feat(contracts): add seo draft pipeline schemas"
```

---

### Task 2: Add DB tables for runs, candidates, opportunities, and drafts

**Files:**

- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`
- Create: `packages/db/drizzle/0008_<generated>.sql`

**Step 1: Add the four tables**

Append to `packages/db/src/schema.ts`:

```ts
export const seoPipelineRuns = waltSchema.table(
  'seo_pipeline_runs',
  {
    id: uuid('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    marketKey: text('market_key').notNull(),
    siteKey: text('site_key').notNull(),
    trigger: text('trigger').notNull().default('manual'),
    status: text('status').notNull(),
    createdBy: text('created_by').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    errorSummary: text('error_summary'),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (table) => ({
    orgIdx: index('seo_pipeline_runs_org_idx').on(table.organizationId),
    marketIdx: index('seo_pipeline_runs_market_idx').on(table.marketKey, table.siteKey),
  }),
);

export const seoEventCandidates = waltSchema.table(
  'seo_event_candidates',
  {
    id: uuid('id').primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => seoPipelineRuns.id),
    organizationId: text('organization_id').notNull(),
    marketKey: text('market_key').notNull(),
    sourceId: text('source_id').notNull(),
    sourceUrl: text('source_url').notNull(),
    sourceDomain: text('source_domain').notNull(),
    title: text('title').notNull(),
    venueName: text('venue_name'),
    city: text('city'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    summary: text('summary'),
    sourceSnippet: text('source_snippet'),
    normalizedHash: text('normalized_hash').notNull(),
    status: text('status').notNull().default('discovered'),
    raw: jsonb('raw').notNull(),
    discoveredAt: timestamp('discovered_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    hashIdx: uniqueIndex('seo_event_candidates_hash_idx').on(
      table.organizationId,
      table.marketKey,
      table.normalizedHash,
    ),
  }),
);

export const seoOpportunities = waltSchema.table(
  'seo_opportunities',
  {
    id: uuid('id').primaryKey(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => seoEventCandidates.id),
    organizationId: text('organization_id').notNull(),
    marketKey: text('market_key').notNull(),
    siteKey: text('site_key').notNull(),
    targetKeyword: text('target_keyword').notNull(),
    targetSlug: text('target_slug').notNull(),
    travelerIntent: text('traveler_intent').notNull(),
    propertyIds: text('property_ids').array().notNull().default([]),
    score: integer('score').notNull(),
    reasons: jsonb('reasons').$type<string[]>().notNull(),
    status: text('status').notNull().default('queued'),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    candidateIdx: uniqueIndex('seo_opportunities_candidate_idx').on(table.candidateId),
    scoreIdx: index('seo_opportunities_score_idx').on(table.organizationId, table.score),
  }),
);

export const seoDrafts = waltSchema.table(
  'seo_drafts',
  {
    id: uuid('id').primaryKey(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => seoOpportunities.id),
    organizationId: text('organization_id').notNull(),
    marketKey: text('market_key').notNull(),
    siteKey: text('site_key').notNull(),
    status: text('status').notNull().default('generated'),
    titleTag: text('title_tag').notNull(),
    metaDescription: text('meta_description').notNull(),
    slug: text('slug').notNull(),
    h1: text('h1').notNull(),
    outline: jsonb('outline').$type<string[]>().notNull(),
    bodyMarkdown: text('body_markdown').notNull(),
    faqItems: jsonb('faq_items').$type<Array<{ question: string; answer: string }>>().notNull(),
    ctaText: text('cta_text').notNull(),
    internalLinks: jsonb('internal_links')
      .$type<Array<{ href: string; anchor: string }>>()
      .notNull(),
    sourceUrls: text('source_urls').array().notNull().default([]),
    reviewNotes: text('review_notes').array().notNull().default([]),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: text('reviewed_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    oppIdx: uniqueIndex('seo_drafts_opportunity_idx').on(table.opportunityId),
    statusIdx: index('seo_drafts_status_idx').on(table.organizationId, table.status, table.updatedAt),
    slugIdx: uniqueIndex('seo_drafts_site_slug_idx').on(table.siteKey, table.slug),
  }),
);
```

**Step 2: Export the new tables**

No custom export is required beyond `packages/db/src/index.ts`, but verify the file still re-exports `schema.ts`.

**Step 3: Typecheck the DB package**

Run:

```bash
pnpm --filter @walt/db typecheck
```

Expected: no schema typing errors.

**Step 4: Generate and inspect the migration**

Run:

```bash
pnpm --filter @walt/db db:generate
```

Expected: a new migration file appears in `packages/db/drizzle/` creating the four SEO tables and indexes.

**Step 5: Apply the migration locally**

Run:

```bash
pnpm --filter @walt/db db:migrate
```

Expected: migration applies cleanly against local Postgres.

**Step 6: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle packages/db/src/index.ts
git commit -m "feat(db): add seo draft pipeline tables"
```

---

### Task 3: Build the event scout, scorer, generator, and reviewer pipeline

**Files:**

- Create: `apps/web/src/lib/seo-drafts/event-sources.ts`
- Create: `apps/web/src/lib/seo-drafts/html-to-text.ts`
- Create: `apps/web/src/lib/seo-drafts/property-context.ts`
- Create: `apps/web/src/lib/seo-drafts/event-scout.ts`
- Create: `apps/web/src/lib/seo-drafts/opportunity-scorer.ts`
- Create: `apps/web/src/lib/seo-drafts/draft-generator.ts`
- Create: `apps/web/src/lib/seo-drafts/reviewer.ts`
- Create: `apps/web/src/lib/seo-drafts/run-pipeline.ts`
- Test: `apps/web/src/lib/seo-drafts/run-pipeline.test.ts`

**Step 1: Write failing pipeline tests first**

Create `apps/web/src/lib/seo-drafts/run-pipeline.test.ts` with deterministic doubles for fetch and generation:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { scoreCandidate } from './opportunity-scorer';
import { reviewDraft } from './reviewer';

void test('scores near-term Frisco events higher than generic regional noise', () => {
  const strong = scoreCandidate({
    title: 'Frisco RoughRiders Home Game',
    city: 'Frisco',
    startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    summary: 'Family-friendly baseball at Riders Field',
  });

  const weak = scoreCandidate({
    title: 'North Texas Sale Weekend',
    city: 'Dallas',
    startsAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    summary: 'Generic shopping promotion',
  });

  assert.equal(strong.score > weak.score, true);
  assert.equal(strong.reasons.length > 0, true);
});

void test('reviewer flags drafts missing source grounding or CTA', () => {
  const result = reviewDraft({
    titleTag: 'Stay Near Frisco Event',
    metaDescription: 'A draft',
    slug: 'frisco-event',
    h1: 'Stay Near Frisco Event',
    outline: ['Intro', 'Where to stay', 'FAQ'],
    bodyMarkdown: 'Short body',
    faqItems: [],
    ctaText: '',
    sourceUrls: [],
  });

  assert.equal(result.status, 'needs_attention');
  assert.equal(result.notes.includes('Missing source URLs'), true);
});
```

**Step 2: Add curated Frisco source definitions**

Create `apps/web/src/lib/seo-drafts/event-sources.ts`:

```ts
export const friscoEventSources = [
  {
    id: 'visit-frisco-calendar',
    label: 'Visit Frisco Events',
    url: 'https://www.visitfrisco.com/events/',
  },
  {
    id: 'toyota-stadium-events',
    label: 'Toyota Stadium Events',
    url: 'https://www.toyotastadium.com/events/',
  },
  {
    id: 'riders-field-events',
    label: 'Riders Field Events',
    url: 'https://www.milb.com/frisco/schedule',
  },
];
```

Do not add admin-editable source management yet.

**Step 3: Implement the HTML text normalizer**

Create `apps/web/src/lib/seo-drafts/html-to-text.ts`:

```ts
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
```

**Step 4: Implement property context loading for Frisco inventory**

Create `apps/web/src/lib/seo-drafts/property-context.ts`:

```ts
import { asc, eq } from 'drizzle-orm';
import { properties } from '@walt/db';
import { db } from '@/lib/db';

export async function getFriscoPropertyContext() {
  return db
    .select({
      id: properties.id,
      name: properties.name,
      city: properties.city,
      raw: properties.raw,
    })
    .from(properties)
    .where(eq(properties.city, 'Frisco'))
    .orderBy(asc(properties.name));
}
```

**Step 5: Implement scout + scorer + generator + reviewer**

Use these design rules:

- `event-scout.ts`: fetch each source URL, convert HTML to text, and use OpenAI structured output to extract upcoming events into normalized candidate objects. Every candidate must keep `sourceUrl`, `sourceId`, `sourceSnippet`, and a `normalizedHash`.
- `opportunity-scorer.ts`: keep scoring deterministic. Weight Frisco location, event recency, family/group travel fit, venue prominence, and property relevance. Deduct for stale dates, vague summaries, and non-Frisco locations.
- `draft-generator.ts`: use property context plus the chosen opportunity to produce `titleTag`, `metaDescription`, `slug`, `outline`, `bodyMarkdown`, `faqItems`, `ctaText`, and `internalLinks`. Require source grounding and explicitly forbid fabricated event facts.
- `reviewer.ts`: run deterministic checks first. Required fields, minimum body length, at least one source URL, non-empty CTA, slug shape, and no stale dates. Optionally add a second LLM pass only for unsupported-claim detection.

Core orchestration in `apps/web/src/lib/seo-drafts/run-pipeline.ts` should look like:

```ts
export async function runSeoDraftPipeline(input: RunSeoPipelineInput, auth: { orgId: string; userId: string }) {
  const run = await createPipelineRun(input, auth);
  try {
    const candidates = await scoutEvents(input, auth.orgId);
    const opportunities = await scoreCandidates(candidates, input, auth.orgId);
    const drafts = await generateDrafts(opportunities, input, auth.orgId);
    const reviewed = drafts.map((draft) => reviewDraft(draft));
    await persistReviewedDrafts(run.id, candidates, opportunities, reviewed, auth.orgId);
    await completeRun(run.id, reviewed);
    return reviewed;
  } catch (error) {
    await failRun(run.id, error);
    throw error;
  }
}
```

**Step 6: Run focused tests**

Run:

```bash
pnpm --filter @walt/web exec tsx --test src/lib/seo-drafts/run-pipeline.test.ts
```

Expected: scorer and reviewer tests pass before wiring routes.

**Step 7: Commit**

```bash
git add apps/web/src/lib/seo-drafts
git commit -m "feat(web): add seo draft pipeline workers"
```

---

### Task 4: Expose manual run, list, and review APIs

**Files:**

- Create: `apps/web/src/app/api/command-center/seo-drafts/route.ts`
- Create: `apps/web/src/app/api/command-center/seo-drafts/run/route.ts`
- Create: `apps/web/src/app/api/command-center/seo-drafts/[id]/route.ts`
- Test: `apps/web/src/app/api/command-center/seo-drafts/route.test.ts`

**Step 1: Write failing route tests**

Create `apps/web/src/app/api/command-center/seo-drafts/route.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { GET as listDrafts } from './route';
import { POST as runDrafts } from './run/route';

void test('lists seo drafts for the authenticated org', async () => {
  const response = await listDrafts(
    new Request('http://localhost/api/command-center/seo-drafts', {
      headers: { 'x-test-auth-org-id': 'test-org' },
    }),
  );

  assert.equal(response.status, 200);
});

void test('starts a manual SEO pipeline run', async () => {
  const response = await runDrafts(
    new Request('http://localhost/api/command-center/seo-drafts/run', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-auth-org-id': 'test-org',
      },
      body: JSON.stringify({ marketKey: 'frisco-tx', siteKey: 'stayinfrisco' }),
    }),
  );

  assert.equal(response.status, 200);
});
```

**Step 2: Implement the list route**

Create `apps/web/src/app/api/command-center/seo-drafts/route.ts` with `withPermission('dashboard.read', ...)`:

- Validate query params (`status`, `limit`).
- Read from `seoDrafts` joined to `seoOpportunities` and `seoEventCandidates`.
- Scope by `authContext.orgId`.
- Return newest first.

**Step 3: Implement the run route**

Create `apps/web/src/app/api/command-center/seo-drafts/run/route.ts` with `withPermission('drafts.write', ...)`:

- Parse `runSeoPipelineInputSchema`.
- Call `runSeoDraftPipeline`.
- Return `runId`, counts, and top draft summaries.
- Guard missing `OPENAI_API_KEY` with a `503` JSON error instead of crashing.

**Step 4: Implement the review route**

Create `apps/web/src/app/api/command-center/seo-drafts/[id]/route.ts` with `withPermission('drafts.write', ...)`:

- Parse `reviewSeoDraftInputSchema`.
- Update `status`, append `reviewNotes`, stamp `reviewedAt` and `reviewedBy`.
- Reject updates across organizations.

**Step 5: Run the route tests**

Run:

```bash
pnpm --filter @walt/web exec tsx --test src/app/api/command-center/seo-drafts/route.test.ts
```

Expected: list, run, and review handlers return expected status codes and enforce auth scoping.

**Step 6: Commit**

```bash
git add apps/web/src/app/api/command-center/seo-drafts
git commit -m "feat(web): add seo draft pipeline APIs"
```

---

### Task 5: Add the review queue UI to the web app

**Files:**

- Create: `apps/web/src/app/seo-drafts/page.tsx`
- Create: `apps/web/src/app/seo-drafts/RunSeoDraftsButton.tsx`
- Create: `apps/web/src/app/seo-drafts/DraftReviewActions.tsx`
- Modify: `apps/web/src/lib/nav-links.ts`

**Step 1: Add the nav link**

Update `apps/web/src/lib/nav-links.ts`:

```ts
{ href: '/seo-drafts', label: 'SEO Drafts' },
```

Place it near `Questions` and `Properties`, not inside inbox-specific flows.

**Step 2: Build the server-rendered queue page**

Create `apps/web/src/app/seo-drafts/page.tsx`:

- Query the latest 25 drafts for the authenticated org.
- Show summary counts by status.
- Render draft cards with title, keyword, score, source links, generated timestamp, and review notes.
- Include empty states for no drafts and no Frisco properties.

The page should read from DB directly for initial render, following the pattern in `apps/web/src/app/questions/page.tsx`.

**Step 3: Add the manual run button**

Create `apps/web/src/app/seo-drafts/RunSeoDraftsButton.tsx`:

```tsx
'use client';

import { useState } from 'react';

export function RunSeoDraftsButton() {
  const [pending, setPending] = useState(false);

  async function onRun() {
    setPending(true);
    try {
      await fetch('/api/command-center/seo-drafts/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ marketKey: 'frisco-tx', siteKey: 'stayinfrisco' }),
      });
      window.location.reload();
    } finally {
      setPending(false);
    }
  }

  return (
    <button onClick={() => void onRun()} disabled={pending}>
      {pending ? 'Generating…' : 'Run Frisco SEO Drafts'}
    </button>
  );
}
```

Keep it simple for MVP; no background polling yet.

**Step 4: Add review actions**

Create `apps/web/src/app/seo-drafts/DraftReviewActions.tsx`:

- Buttons: `Approve`, `Reject`, `Needs Attention`.
- Optional free-text note.
- POST to `PATCH /api/command-center/seo-drafts/[id]`.
- Reload page on success.

**Step 5: Smoke-test the page locally**

Run:

```bash
pnpm --filter @walt/web typecheck
pnpm --filter @walt/web test
```

Expected: the new page compiles and existing tests remain green.

**Step 6: Commit**

```bash
git add apps/web/src/app/seo-drafts apps/web/src/lib/nav-links.ts
git commit -m "feat(web): add seo draft review queue"
```

---

### Task 6: Verification and handoff

**Files:**

- Modify: `docs/plans/2026-03-17-stayinfrisco-seo-draft-pipeline-mvp.md`

**Step 1: Run focused package checks**

Run:

```bash
pnpm --filter @walt/db typecheck
pnpm --filter @walt/web typecheck
pnpm --filter @walt/web test
```

Expected: all commands pass.

**Step 2: Run workspace-level safety checks**

Run:

```bash
pnpm lint
pnpm build
```

Expected: no regressions outside the new SEO flow.

**Step 3: Manual acceptance checklist**

Verify these manually:

1. `POST /api/command-center/seo-drafts/run` creates one pipeline run and persists candidates, opportunities, and drafts.
2. The `/seo-drafts` page shows generated drafts with source URLs and review state.
3. Approve/reject actions update status and notes correctly.
4. Missing `OPENAI_API_KEY` returns a safe API error instead of a crash.
5. Duplicate event runs do not create duplicate candidates for the same normalized event hash.

**Step 4: Record implementation notes**

At the bottom of this plan, append:

- actual source URLs chosen for Frisco MVP
- any fields added/removed from the draft package
- any follow-up tickets deferred to Phase 2 (`publishing`, `analytics feedback`, `Search Console`, `auto-refresh`)

**Step 5: Final commit**

```bash
git add docs/plans/2026-03-17-stayinfrisco-seo-draft-pipeline-mvp.md
git commit -m "docs: add stayinfrisco seo draft pipeline MVP plan"
```

---

## Phase 2, explicitly deferred

- Publish approved drafts into the separate StayInFrisco service.
- Track post-publication performance via GA4/Search Console.
- Add automated refresh recommendations for underperforming or stale pages.
- Expand beyond Frisco into Celina/Prosper with a separate midterm-rental intent model.
- Add source management UI and scheduling.
