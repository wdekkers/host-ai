# Walt Monorepo

Monorepo scaffold for Walt AI command center and microservices.

## Stack

- Monorepo: `pnpm` workspaces + `Turborepo`
- Frontend: `Next.js` (`apps/web`)
- API/BFF + services: `Fastify` + `TypeScript`
- Validation/contracts: `Zod` (`packages/contracts`)
- OpenAPI/Swagger: `@fastify/swagger` + generated schema from shared Zod contracts
- DB: `PostgreSQL` + `drizzle-orm` (`packages/db`)
- Tooling: `ESLint` + `Prettier`
- Third-party API codegen: `openapi-typescript` from YAML (`specs/third-party`)

## Workspace Layout

- `apps/web`: Next.js dashboard
- `apps/gateway`: API gateway + Swagger docs
- `services/identity`: Identity service
- `services/messaging`: Messaging service
- `services/ops`: Operations service
- `services/notifications`: Notifications service
- `packages/contracts`: Shared Zod schemas/contracts
- `packages/db`: Shared DB schema/client
- `packages/api-client`: Shared API runtime + generated third-party API types
- `packages/config-eslint`: Shared ESLint config
- `packages/config-typescript`: Shared TS config
- `specs/third-party`: Third-party OpenAPI YAML specs
- `infra/docker-compose.yml`: Local Postgres

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Start Postgres:

```bash
docker compose -f infra/docker-compose.yml up -d
```

3. Generate third-party API types from YAML files:

```bash
pnpm gen:openapi
```

4. Run all apps/services:

```bash
pnpm dev
```

## Integration Setup (Hospitable)

For the `apps/web` integration routes, configure env vars in either:

- repo root `.env` (shared), or
- `apps/web/.env.local` (app-local, based on `apps/web/.env.example`)

Required keys:

```bash
HOSPITABLE_WEBHOOK_SECRET=...
HOSPITABLE_API_KEY=...
HOSPITABLE_BASE_URL=https://api.hospitable.com
```

- `POST /api/integrations/hospitable` ingests signed webhook events.
- `GET /api/integrations/hospitable/messages` pulls outbound messages from Hospitable API (requires API key/base URL).

## Twilio SMS Consent (Vendor Messaging)

The vendor SMS consent system lets vendors opt in/out of operational text messages and gives admins visibility into consent status.

### Environment setup

Copy `.env.example` to `.env` and fill in:

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=replace-me
TWILIO_FROM_NUMBER=+1xxxxxxxxxx   # your Twilio number
PUBLIC_URL=https://replace-me.ngrok-free.app  # for local webhook testing
```

Also update `apps/web/.env.local` with:

```bash
MESSAGING_SERVICE_URL=http://localhost:3002
GATEWAY_URL=http://localhost:3001
TWILIO_AUTH_TOKEN=replace-me
```

### Local webhook testing with ngrok

Twilio requires a public HTTPS URL to deliver inbound SMS webhooks. Use ngrok to expose your local Next.js app:

```bash
# 1. Start the full stack
pnpm dev

# 2. In another terminal, expose port 3000
ngrok http 3000

# 3. Copy the ngrok HTTPS URL (e.g. https://abc123.ngrok-free.app)
#    Set it in .env: PUBLIC_URL=https://abc123.ngrok-free.app

# 4. In the Twilio console, set your phone number's inbound webhook to:
#    https://abc123.ngrok-free.app/api/twilio/inbound
#    (HTTP POST, application/x-www-form-urlencoded)

# 5. Set the status callback URL to:
#    https://abc123.ngrok-free.app/api/twilio/status
```

> ngrok is for **local development only**. In production, configure `PUBLIC_URL` to your deployed domain and set the Twilio webhook URLs in the Twilio console to match.

### Public pages

| Route          | Purpose             |
| -------------- | ------------------- |
| `/sms/opt-in`  | Vendor opt-in form  |
| `/sms/opt-out` | Vendor opt-out form |
| `/sms/privacy` | SMS privacy policy  |
| `/sms/terms`   | SMS messaging terms |

### Admin

`/admin/vendors` (requires Clerk login) — view all vendors, consent status, message history, and disable messaging for individual vendors.

### Inbound keyword handling

| Keyword                                  | Action                     |
| ---------------------------------------- | -------------------------- |
| STOP / QUIT / CANCEL / UNSUBSCRIBE / END | Opt out, send confirmation |
| START / YES / UNSTOP                     | Opt in, send confirmation  |
| HELP / INFO                              | Send help reply            |

## Useful Commands

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm format:write
```
