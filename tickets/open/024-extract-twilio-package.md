---
id: "024"
title: Extract Twilio integration into @walt/twilio package
status: open
priority: high
tags: [architecture, integration, messaging, refactor]
created: 2026-03-22
assignee: unassigned
---

# Extract Twilio integration into @walt/twilio package

## Summary

Move all Twilio SDK usage (SMS sending, webhook signature validation) out of `apps/web` into a dedicated `packages/twilio` package.

## Context

Twilio is used for core guest messaging. The SDK is currently imported directly in route handlers and lib files within `apps/web`. Extracting it allows the gateway or future services to send SMS without depending on the Next.js app.

## Files to Migrate

| Current location | Target | What it does |
|------------------|--------|-------------|
| `apps/web/src/app/api/twilio/inbound/route.ts` | Extract validation into package | Webhook receiver, signature validation |
| `apps/web/src/lib/reminders/send-reminder.ts` (Twilio parts) | `packages/twilio/src/sms.ts` | Creates client, sends SMS |
| `apps/web/src/lib/consent-text.ts` | Evaluate — may stay or move | Consent/opt-in text templates |

## Requirements

- `TwilioClient` class with methods: `sendSms()`, `validateWebhookSignature()`
- Zod schemas for inbound webhook payloads
- Env config with Zod validation (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`)
- No Next.js dependencies in the package
- `twilio` SDK is a dependency of the package, not of `apps/web`

## Acceptance Criteria

- [ ] `packages/twilio` package created with proper tsconfig and exports
- [ ] `TwilioClient` exposes typed methods for SMS and webhook validation
- [ ] Webhook payloads validated with Zod schemas
- [ ] `apps/web` routes import from `@walt/twilio` — no direct `twilio` SDK imports
- [ ] Existing tests pass or are migrated
- [ ] No functionality regression

## References

- Migration inventory: `docs/migration-inventory.md`
