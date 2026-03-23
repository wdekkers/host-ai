---
id: "023"
title: Extract Hospitable integration into @walt/hospitable package
status: open
priority: high
tags: [architecture, integration, refactor]
created: 2026-03-22
assignee: unassigned
---

# Extract Hospitable integration into @walt/hospitable package

## Summary

Move all Hospitable API calls, response normalization, and thread-building logic out of `apps/web` into a dedicated `packages/hospitable` package so it can be reused across services.

## Context

Currently all Hospitable integration code lives directly in `apps/web` as raw `fetch()` calls with Bearer token auth. This couples the integration to Next.js and prevents reuse in the gateway or future services.

## Files to Migrate

| Current location | Target | What it does |
|------------------|--------|-------------|
| `apps/web/src/lib/integrations-env.ts` | `packages/hospitable/src/config.ts` | Zod-validated env config |
| `apps/web/src/app/api/admin/sync-hospitable/handler.ts` | Extract API calls into package client | Full sync: properties, reservations, messages |
| `apps/web/src/app/api/integrations/hospitable/messages/route.ts` | Extract fetch into package | Reservation messages |
| `apps/web/src/app/api/integrations/hospitable/properties/route.ts` | Extract fetch into package | Properties list |
| `apps/web/src/app/api/integrations/hospitable/reservations/route.ts` | Extract fetch into package | Reservations with filters |
| `apps/web/src/lib/hospitable-normalize.ts` | `packages/hospitable/src/normalize.ts` | API response normalization |
| `apps/web/src/lib/hospitable-thread.ts` | `packages/hospitable/src/threads.ts` | Build message threads |

## Requirements

- `HospitableClient` class with methods: `listProperties()`, `listReservations()`, `getMessages()`, `syncAll()`
- Zod schemas for all Hospitable API response shapes
- Paginated fetching handled inside the client (not in route handlers)
- Env config with Zod validation
- No Next.js dependencies in the package
- `apps/web` route handlers import from `@walt/hospitable`

## Acceptance Criteria

- [ ] `packages/hospitable` package created with proper tsconfig and exports
- [ ] `HospitableClient` exposes typed methods for all API operations
- [ ] All API response shapes validated with Zod schemas
- [ ] `apps/web` routes refactored to use `@walt/hospitable` — no raw `fetch()` to Hospitable
- [ ] Existing tests pass or are migrated
- [ ] No functionality regression

## References

- Migration inventory: `docs/migration-inventory.md`
- Existing env config pattern: `apps/web/src/lib/integrations-env.ts`
