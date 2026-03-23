# Migration Inventory: Extract Integration Packages

This document identifies all code currently embedded in `apps/web` that should be
extracted into dedicated `packages/` for reuse across services.

---

## 1. `@walt/hospitable` — Hospitable API Client

**Priority: High** — Most code to extract, raw `fetch()` calls with no abstraction.

| File | What it does | Migration action |
|------|-------------|-----------------|
| `apps/web/src/lib/integrations-env.ts` | Zod-validated env config for Hospitable keys | Move to `packages/hospitable/src/config.ts` |
| `apps/web/src/app/api/admin/sync-hospitable/handler.ts` | Full sync: properties, reservations, messages via paginated `fetch()` | Extract API calls into package client; keep orchestration in handler |
| `apps/web/src/app/api/integrations/hospitable/messages/route.ts` | Fetch reservation messages | Extract `fetch()` call into package |
| `apps/web/src/app/api/integrations/hospitable/properties/route.ts` | Fetch properties list | Extract `fetch()` call into package |
| `apps/web/src/app/api/integrations/hospitable/reservations/route.ts` | Fetch reservations with filters | Extract `fetch()` call into package |
| `apps/web/src/lib/hospitable-normalize.ts` | Normalize Hospitable API responses to internal types | Move to `packages/hospitable/src/normalize.ts` |
| `apps/web/src/lib/hospitable-thread.ts` | Build message threads from Hospitable data | Move to `packages/hospitable/src/threads.ts` |

**Package should expose:**
- `HospitableClient` class with methods: `listProperties()`, `listReservations()`, `getMessages()`, `syncAll()`
- Zod schemas for all Hospitable API response shapes
- Normalization functions for converting API responses → internal types

---

## 2. `@walt/twilio` — Twilio SMS Client

**Priority: High** — Used for core messaging functionality.

| File | What it does | Migration action |
|------|-------------|-----------------|
| `apps/web/src/app/api/twilio/inbound/route.ts` | Webhook receiver, validates Twilio signature, processes inbound SMS | Extract signature validation + client setup into package |
| `apps/web/src/lib/reminders/send-reminder.ts` | Creates Twilio client, sends SMS via `client.messages.create()` | Extract into `packages/twilio/src/sms.ts` |
| `apps/web/src/lib/consent-text.ts` | Consent/opt-in text templates | Move to package if Twilio-specific, otherwise keep in contracts |

**Package should expose:**
- `TwilioClient` class with methods: `sendSms()`, `validateWebhookSignature()`
- Zod schemas for inbound webhook payloads
- Env config validation

---

## 3. `@walt/resend` — Resend Email Client

**Priority: Medium** — Small surface area but should still be extracted.

| File | What it does | Migration action |
|------|-------------|-----------------|
| `apps/web/src/lib/reminders/send-reminder.ts` | Creates Resend client, sends email | Extract into `packages/resend/src/client.ts` |

**Package should expose:**
- `ResendClient` class with methods: `sendEmail()`
- Env config validation
- Shared email templates (if any)

---

## 4. `@walt/ai` — AI/LLM Client Wrappers

**Priority: High** — Used extensively, multiple models and providers.

| File | What it does | Migration action |
|------|-------------|-----------------|
| `apps/web/src/lib/ai/analyze-message.ts` | Claude-based message intent + escalation analysis | Extract into `packages/ai/src/analyze.ts` |
| `apps/web/src/lib/ai/classify-message.ts` | Claude-based message classification | Extract into `packages/ai/src/classify.ts` |
| `apps/web/src/lib/ai/escalation-keywords.ts` | Keyword matching for escalation detection | Extract into `packages/ai/src/escalation.ts` |
| `apps/web/src/lib/generate-reply-suggestion.ts` | OpenAI-based guest reply suggestion | Extract into `packages/ai/src/suggest.ts` |
| `apps/web/src/lib/guest-scoring.ts` | OpenAI-based guest quality scoring | Extract into `packages/ai/src/scoring.ts` |
| `apps/web/src/lib/grade-simulator-response.ts` | OpenAI-based response grading for QA | Extract into `packages/ai/src/grading.ts` |
| `apps/web/src/lib/seo-drafts/draft-generator.ts` | OpenAI-based SEO content generation | Extract into `packages/ai/src/seo/` |
| `apps/web/src/lib/seo-drafts/event-scout.ts` | OpenAI-based event detection | Extract into `packages/ai/src/seo/` |
| `apps/web/src/lib/seo-drafts/reviewer.ts` | AI-based draft review | Extract into `packages/ai/src/seo/` |

**Package should expose:**
- `AiClient` factory that wraps both OpenAI and Anthropic SDKs
- Individual function exports: `analyzeMessage()`, `classifyMessage()`, `generateReplySuggestion()`, `scoreGuest()`, etc.
- Zod schemas for all AI request/response shapes
- Model constants and prompt templates

---

## 5. Files that stay in `apps/web`

These are Next.js-specific or UI-specific and do NOT need extraction:

| File | Reason to keep |
|------|---------------|
| `apps/web/src/lib/auth/*` | Clerk auth — Next.js-specific |
| `apps/web/src/lib/db.ts` | Drizzle client init — app-specific |
| `apps/web/src/lib/nav-links.ts` | UI navigation — frontend-specific |
| `apps/web/src/lib/utils.ts` | UI utilities (cn, etc.) |
| `apps/web/src/lib/simulator-templates.ts` | QA simulator config — app-specific |
| `apps/web/src/lib/command-center-store.ts` | UI state — app-specific |
| `apps/web/src/lib/messaging-fallback-store.ts` | App-specific fallback logic |
| `apps/web/src/lib/secure-logger.ts` | Could go into a shared package later but low priority |

---

## 6. Suggested migration order

1. **`@walt/hospitable`** — Largest surface area, most raw `fetch()` calls, highest reuse potential (gateway could also use it)
2. **`@walt/ai`** — Heavily used across many features, standardizing model access is high value
3. **`@walt/twilio`** — Core messaging path, webhook validation is security-critical
4. **`@walt/resend`** — Small, quick win
5. **ReiHub** (future) — Create `@walt/reihub` package from the start when this integration is built

---

## 7. Package template

Each new package should follow this structure:

```
packages/<name>/
  package.json          ← name: @walt/<name>, exports, dependencies
  tsconfig.json         ← extends @walt/config-typescript
  src/
    index.ts            ← public API exports
    client.ts           ← main client class/factory
    config.ts           ← Zod-validated env config
    schemas.ts          ← Zod schemas for API request/response types
    __tests__/          ← unit tests
```
