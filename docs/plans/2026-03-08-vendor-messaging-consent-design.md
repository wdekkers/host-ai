# Vendor Messaging Consent System — Design

**Date:** 2026-03-08
**Status:** Approved
**Branch:** feat/vendor-messaging-consent

## Goal

Build a production-ready SMS consent and opt-out flow for vendor communications so the app can document opt-in, respect opt-out, and support future Twilio A2P/10DLC verification review.

## Confirmed Decisions

- **ORM:** Drizzle (existing stack, `packages/db`)
- **Business logic:** Extend `services/messaging` Fastify service
- **Public pages + admin UI:** `apps/web` Next.js
- **Admin auth:** Clerk (already integrated)
- **Twilio:** New install — no existing setup in repo
- **ngrok:** Local webhook testing only

---

## 1. Data Layer (`packages/db`)

Extend `src/schema.ts` with four new Drizzle tables in the existing `waltSchema` (`walt` Postgres schema). New Drizzle enums use `pgEnum`.

### Enums

```
vendorStatus:     invited | active | opted_out | blocked
consentStatus:    opted_in | opted_out | pending
consentMethod:    web_form | inbound_sms | admin_import
messageDirection: outbound | inbound
messageType:      operational | consent_confirmation | help | stop_confirmation
actorType:        system | admin | vendor
```

### Tables

**`vendors`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| company_name | text | |
| contact_name | text | |
| phone_e164 | text | unique |
| email | text | nullable |
| status | vendorStatus | default: invited |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**`sms_consents`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| vendor_id | uuid FK → vendors | |
| consent_status | consentStatus | |
| consent_method | consentMethod | |
| consent_text_version | text | e.g. "v1" |
| consent_text_snapshot | text | exact text shown |
| source_url | text | full URL of form page |
| source_domain | text | hostname only |
| ip_address | text | nullable |
| user_agent | text | nullable |
| checkbox_checked | boolean | |
| confirmed_at | timestamptz | nullable |
| revoked_at | timestamptz | nullable |
| created_at | timestamptz | |

**`sms_message_logs`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| vendor_id | uuid FK → vendors | |
| direction | messageDirection | |
| twilio_message_sid | text | nullable |
| from_number | text | |
| to_number | text | |
| body | text | |
| message_type | messageType | |
| delivery_status | text | nullable, updated via status webhook |
| created_at | timestamptz | |

**`audit_events`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| vendor_id | uuid | nullable, no FK for orphan-safety |
| actor_type | actorType | |
| actor_id | text | nullable |
| event_type | text | e.g. "vendor.opted_out" |
| metadata | jsonb | |
| created_at | timestamptz | |

---

## 2. Messaging Service (`services/messaging`)

Replace in-memory mock with real Drizzle DB connection. Add Twilio SDK.

### New modules

- **`src/consent-text.ts`** — exports `CONSENT_TEXT_V1` literal string + version constant
- **`src/twilio.ts`** — Twilio client wrapper: `sendSms()`, `validateSignature()`
- **`src/db.ts`** — creates Drizzle client from `DATABASE_URL`
- **`src/lib/phone.ts`** — E.164 normalization utility
- **`src/lib/sms-guard.ts`** — `canSendToVendor()`: checks latest consent before any outbound send

### New routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /consent/opt-in | Upsert vendor, create SmsConsent, send confirmation SMS |
| POST | /consent/opt-out | Revoke consent, update vendor status, send opt-out SMS |
| POST | /sms/send | Guarded outbound send (checks consent first) |
| GET | /vendors | List vendors with consent + message summary |
| GET | /vendors/:id/history | Full consent history + audit trail |
| PATCH | /vendors/:id/disable | Admin: set status to blocked |
| POST | /webhooks/inbound | Twilio inbound SMS (Twilio signature validated) |
| POST | /webhooks/status | Twilio status callback — updates delivery_status |

### Inbound webhook keyword handling

| Keyword(s) | Action |
|------------|--------|
| STOP, UNSUBSCRIBE, CANCEL, END, QUIT, STOPALL | Mark opted_out, audit event, log message, return empty TwiML (Twilio handles reply) |
| START, UNSTOP | New opted_in consent (method: inbound_sms), vendor → active |
| HELP | Reply with help text TwiML |
| Other | Store in sms_message_logs as operational inbound, visible in shared inbox |

---

## 3. Gateway (`apps/gateway`)

Add proxy routes following the existing pattern (proxies to `MESSAGING_SERVICE_URL`):

- `GET /vendors`
- `GET /vendors/:id/history`
- `PATCH /vendors/:id/disable`

---

## 4. Web App (`apps/web`)

### Public pages (no auth)

| Route | Purpose |
|-------|---------|
| `/sms/opt-in` | Opt-in form: contact name, company (optional), phone, required checkbox + consent text |
| `/sms/opt-out` | Opt-out form: phone number entry |
| `/sms/privacy` | Static privacy policy |
| `/sms/terms` | Static messaging terms |

### API routes

| Method | Path | Action |
|--------|------|--------|
| POST | /api/sms/opt-in | Validate (Zod), extract IP/UA, proxy to messaging service |
| POST | /api/sms/opt-out | Validate (Zod), proxy to messaging service |
| POST | /api/twilio/inbound | Raw passthrough to messaging service `/webhooks/inbound` |
| POST | /api/twilio/status | Passthrough to messaging service `/webhooks/status` |

### Admin page (Clerk-protected)

- `/admin/vendors` — searchable vendor table: name, phone, consent status, last consent date, last message date
- Disable button → calls `PATCH /api/gateway/vendors/:id/disable`
- History link → modal/drawer with full consent + audit trail

---

## 5. Copy & Brand

**Brand name:** WALT Services

**Confirmation SMS (opt-in):**
> WALT Services: You're subscribed for work-related vendor texts about scheduling and property operations. Msg frequency varies. Reply STOP to opt out, HELP for help.

**Opt-out confirmation SMS:**
> You've been unsubscribed from WALT Services vendor texts. Reply START to resubscribe.

**HELP reply:**
> WALT Services: For scheduling, maintenance, and property operations support. Msg frequency varies. Reply STOP to unsubscribe. Contact support@waltservices.com for help.

**Consent checkbox text (opt-in form):**
> I agree to receive work-related text messages from WALT Services about scheduling, cleaning, maintenance, property access, and urgent operational issues. Message frequency varies. Reply STOP to opt out or HELP for help. Message and data rates may apply.

**Consent text version:** `v1`

---

## 6. Configuration

New env vars added to `.env.example` and `apps/web/.env.example`:

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_MESSAGING_SERVICE_SID=   # optional
NEXT_PUBLIC_APP_URL=
```

---

## 7. Non-Goals

- No billing
- No multi-tenant complexity
- No separate auth system (Clerk already handles admin)
- No marketing or promotional SMS — operational only

---

## 8. Testing (Local)

Use ngrok or Twilio CLI to expose local webhook endpoints:

```bash
# Option A: ngrok
ngrok http 3000
# Set Twilio webhook URL to: https://<ngrok-id>.ngrok.io/api/twilio/inbound

# Option B: Twilio CLI
twilio phone-numbers:update <YOUR_NUMBER> \
  --sms-url="http://localhost:3000/api/twilio/inbound"
```
