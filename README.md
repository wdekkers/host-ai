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

## Useful Commands

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm format:write
```
