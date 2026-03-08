# Reservation Thread Cursor Pagination Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Load only the latest 5 messages for a reservation thread initially, lazy-load older messages while scrolling up, and auto-open on the latest message.

**Architecture:** Extend the Hospitable messages API with `beforeCursor` pagination based on `(sentAt,id)` ordering. Update the reservation thread UI state to manage paged history, top-triggered lazy loading, and scroll-anchor preservation when prepending messages.

**Tech Stack:** Next.js App Router API routes, TypeScript, React hooks, Node test runner (`tsx --test`)

---

### Task 1: Add failing API tests for cursor pagination

**Files:**

- Modify: `apps/web/src/lib/command-center-store.test.ts`

**Step 1: Write failing tests**

- Add tests for `/api/integrations/hospitable/messages` to assert:
  - initial request with `reservationId` + `limit=5` returns latest 5 and pagination metadata.
  - follow-up request with `beforeCursor` returns next older chunk.
  - response includes `hasMoreOlder` and `nextBeforeCursor`.

**Step 2: Run test to verify fail**
Run: `pnpm --filter @walt/web test`
Expected: new pagination tests fail with missing cursor fields/behavior.

### Task 2: Implement cursor pagination in API route

**Files:**

- Modify: `apps/web/src/app/api/integrations/hospitable/messages/route.ts`

**Step 1: Add query parsing and cursor utilities**

- Parse optional `beforeCursor`.
- Add helpers to encode/decode cursor using base64 JSON `{ sentAt, id }`.

**Step 2: Implement stable sorting and pagination window**

- Sort messages by `sentAt`, tie-break by `id`.
- For initial request: select latest `limit`.
- For `beforeCursor`: select messages strictly older than cursor, then take newest `limit` of that subset.

**Step 3: Return pagination metadata**

- `page: { limit, hasMoreOlder, nextBeforeCursor, newestMessageId, oldestMessageId }`.

**Step 4: Run tests**
Run: `pnpm --filter @walt/web test`
Expected: API pagination tests pass.

### Task 3: Add failing UI test for incremental loading behavior

**Files:**

- Modify: `apps/web/src/lib/command-center-store.test.ts`

**Step 1: Write failing test**

- Verify dashboard message loader requests `limit=5` first.
- Verify requesting older messages sends `beforeCursor` and appends/prepends correctly in state.

**Step 2: Run test to verify fail**
Run: `pnpm --filter @walt/web test`
Expected: UI behavior test fails due current single-shot load logic.

### Task 4: Implement reservation-thread lazy loading in dashboard

**Files:**

- Modify: `apps/web/src/components/command-center-dashboard.tsx`

**Step 1: Add thread pagination state**

- Store `reservationMessages`, `nextBeforeCursor`, `hasMoreOlder`, `isLoadingInitial`, `isLoadingOlder`.

**Step 2: Update initial load behavior**

- Replace current load call to request `limit=5`.
- Set thread state from `items + page`.

**Step 3: Add older-message loader**

- Add `loadOlderHospitableMessages()` using `beforeCursor`.
- Prepend unique messages by `id` and update page metadata.

**Step 4: Auto-scroll to latest message**

- Attach ref to messages container and scroll to bottom after initial load.

**Step 5: Add top-trigger UI control (v1)**

- Add explicit “Load older messages” button at top when `hasMoreOlder=true`.
- Show loading/error states.

**Step 6: Run tests**
Run: `pnpm --filter @walt/web test`
Expected: all tests green.

### Task 5: Verification and quality gate

**Files:**

- None (verification only)

**Step 1: Typecheck web app**
Run: `pnpm --filter @walt/web typecheck`
Expected: pass.

**Step 2: Record changed files and summary**
Run: `git status --short`
Expected: only intended files modified.

**Step 3: Commit**

```bash
git add apps/web/src/app/api/integrations/hospitable/messages/route.ts \
        apps/web/src/components/command-center-dashboard.tsx \
        apps/web/src/lib/command-center-store.test.ts \
        docs/plans/2026-03-07-reservation-thread-cursor-pagination-implementation.md
git commit -m "feat(web): paginate reservation messages with cursor-based lazy loading"
```
