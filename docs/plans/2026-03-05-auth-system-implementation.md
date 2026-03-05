# Auth System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Protect UI and API routes with org-scoped RBAC using Clerk as the primary auth provider.

**Architecture:** Add a shared contracts-based auth model, enforce auth at Next middleware + API handler level, and harden gateway JWT verification with route-level permission checks. Actor identity for mutations must come from authenticated server context.

**Tech Stack:** Next.js App Router, Clerk, Zod contracts, Fastify, Drizzle/Postgres.

---

### Task 1: Clerk Wiring

**Files:**
- Modify: `apps/web/package.json`
- Modify: `.env.example`
- Modify: `apps/web/.env.example`
- Modify: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx`
- Create: `apps/web/src/middleware.ts`

**Steps:**
1. Add Clerk package and env variables.
2. Wrap app with `ClerkProvider`.
3. Add sign-in page route.
4. Protect all routes except sign-in and POST webhook endpoint.

### Task 2: Shared Auth Contracts

**Files:**
- Create: `packages/contracts/src/auth.ts`
- Modify: `packages/contracts/src/index.ts`

**Steps:**
1. Add role schema.
2. Add permission constants + schema.
3. Add auth context schema (user/org/role/propertyIds).
4. Export from contracts index.

### Task 3: Auth Engine + Route Matrix

**Files:**
- Create: `apps/web/src/lib/auth/get-auth-context.ts`
- Create: `apps/web/src/lib/auth/permissions.ts`
- Create: `apps/web/src/lib/auth/authorize.ts`
- Create: `apps/web/src/lib/auth/permissions.test.ts`

**Steps:**
1. Resolve auth context from Clerk claims.
2. Define role-to-permission map.
3. Define API route-to-permission matrix.
4. Add reusable route guards and tests.

### Task 4: Stop Trusting Client Actor

**Files:**
- Modify: `packages/contracts/src/command-center.ts`
- Modify: `apps/web/src/app/api/command-center/queue/[id]/route.ts`
- Modify: `apps/web/src/app/api/command-center/intent-drafts/route.ts`
- Modify: `apps/web/src/app/api/command-center/property-brain/[id]/route.ts`

**Steps:**
1. Remove actor defaulting from request contracts.
2. Set actor from authenticated server context in handlers.
3. Keep limited test-only compatibility shim to avoid test suite breakage.

### Task 5: Org/Team Data Model

**Files:**
- Modify: `packages/db/src/schema.ts`

**Steps:**
1. Add `organizations`.
2. Add `organization_memberships`.
3. Add `property_access`.
4. Follow with migration generation once workspace package graph is fixed.

### Task 6: UI Authorization Behavior

**Files:**
- Modify: `apps/web/src/components/command-center-dashboard.tsx`

**Steps:**
1. Handle 401 by redirecting to sign-in.
2. Handle 403 by entering read-only mode.
3. Hide restricted action controls (queue actions/autopilot/configure).
4. Keep server authorization as source of truth.

### Task 7: Gateway Hardening

**Files:**
- Create: `apps/gateway/src/plugins/auth.ts`
- Create: `apps/gateway/src/plugins/authorize.ts`
- Modify: `apps/gateway/src/index.ts`

**Steps:**
1. Verify bearer JWT against issuer/JWKS.
2. Attach auth context to request.
3. Add permission preHandler helper.
4. Keep `/health` public.

### Task 8: Verification

**Commands:**
1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm build`

**Expected blockers to clear before full verification:**
1. Fix workspace dependency reference (`@hostpilot/contracts`) in `services/messaging`.
2. Install `@clerk/nextjs`.
