---
id: "025"
title: Extract Resend integration into @walt/resend package
status: open
priority: medium
tags: [architecture, integration, refactor]
created: 2026-03-22
assignee: unassigned
---

# Extract Resend integration into @walt/resend package

## Summary

Move Resend email SDK usage out of `apps/web` into a dedicated `packages/resend` package.

## Context

Small surface area (one file), but extracting it keeps the pattern consistent and allows future services to send emails without depending on the Next.js app.

## Files to Migrate

| Current location | Target | What it does |
|------------------|--------|-------------|
| `apps/web/src/lib/reminders/send-reminder.ts` (Resend parts) | `packages/resend/src/client.ts` | Creates Resend client, sends email |

## Requirements

- `ResendClient` class with methods: `sendEmail()`
- Env config with Zod validation (`RESEND_API_KEY`)
- No Next.js dependencies in the package
- `resend` SDK is a dependency of the package, not of `apps/web`

## Acceptance Criteria

- [ ] `packages/resend` package created with proper tsconfig and exports
- [ ] `ResendClient` exposes typed method for sending email
- [ ] `apps/web` imports from `@walt/resend` — no direct `resend` SDK imports
- [ ] Existing tests pass or are migrated
- [ ] No functionality regression

## References

- Migration inventory: `docs/migration-inventory.md`
