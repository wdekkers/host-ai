# Property Q&A Intelligence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement property-scoped Q&A suggestions with human review, approval/reject APIs, and draft-context integration for recurring guest questions.

**Architecture:** Extend the in-memory command center store as the system-of-record for v1 Q&A entries, suggestions, and suggestion events. Add Command Center API routes for Q&A CRUD, suggestion review actions, and notifications. Trigger suggestion analysis from inbound Hospitable message ingestion and surface approved Q&A as secondary context during draft regeneration.

**Tech Stack:** Next.js App Router route handlers, TypeScript strict mode, Zod schemas in `@walt/contracts`, Node test runner via `tsx --test`.

---

### Task 1: Contract and Route Skeletons

**Files:**
- Modify: `packages/contracts/src/command-center.ts`
- Modify: `apps/web/src/lib/auth/permissions.ts`
- Test: `apps/web/src/lib/auth/permissions.test.ts`
- Create: `apps/web/src/app/api/command-center/qa/[propertyId]/route.ts`
- Create: `apps/web/src/app/api/command-center/qa/entry/[id]/route.ts`
- Create: `apps/web/src/app/api/command-center/qa-suggestions/[propertyId]/route.ts`
- Create: `apps/web/src/app/api/command-center/qa-suggestions/[id]/approve/route.ts`
- Create: `apps/web/src/app/api/command-center/qa-suggestions/[id]/reject/route.ts`
- Create: `apps/web/src/app/api/command-center/qa-suggestions/notifications/route.ts`

**Steps:**
1. Add Q&A entry/suggestion Zod schemas and input schemas to contracts.
2. Add permission mapping/tests for `/api/command-center/qa` and `/api/command-center/qa-suggestions` write actions.
3. Add route handlers with Zod validation and error handling wired to store functions.
4. Run `pnpm --filter @walt/web test src/lib/auth/permissions.test.ts`.

### Task 2: Store Domain for Q&A Entries, Suggestions, and Review Events

**Files:**
- Modify: `apps/web/src/lib/command-center-store.ts`
- Test: `apps/web/src/lib/command-center-store.test.ts`

**Steps:**
1. Add store types and state for `propertyQaEntries`, `propertyQaSuggestions`, and `propertyQaSuggestionEvents`.
2. Add store methods for list/create/update entries; list suggestions; approve/reject suggestions; notification summary.
3. Implement normalized-question deduplication and stale pending auto-archive (30-day default).
4. Write failing tests for approve/edit-approve/reject transitions and dedupe behavior.
5. Implement minimal logic to pass tests.

### Task 3: Inbound Analyzer + Context Integration

**Files:**
- Modify: `apps/web/src/lib/command-center-store.ts`
- Test: `apps/web/src/lib/command-center-store.test.ts`
- Modify: `apps/web/src/app/api/command-center/landing/route.ts`

**Steps:**
1. Trigger suggestion analysis in inbound message ingestion path.
2. Add deterministic analyzer heuristic with statuses (`pending`, `invalid_output`) and confidence/label fields.
3. Integrate approved property Q&A entries into assembled draft context as secondary knowledge, with policy precedence retained.
4. Extend landing payload with pending Q&A review notification count.
5. Add failing tests first for end-to-end inbound -> suggestion -> approve -> context presence flow and landing notification count, then implement.

### Task 4: Verification

**Files:**
- Modify: `apps/web/src/lib/command-center-store.test.ts`

**Steps:**
1. Run focused tests for Q&A behaviors.
2. Run full web test suite.
3. Run workspace typecheck/build if needed to validate no regressions.
