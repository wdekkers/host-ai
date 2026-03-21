# Repository Guidelines

## Project Structure & Module Organization

This repository is a `pnpm` + `Turborepo` monorepo.

- `apps/web`: Next.js frontend (App Router)
- `apps/gateway`: Fastify API gateway and Swagger docs
- `services/*`: domain microservices (`identity`, `messaging`, `ops`, `notifications`)
- `packages/contracts`: shared Zod schemas and types
- `packages/db`: shared Postgres/Drizzle schema and DB helpers
- `packages/api-client`: OpenAPI client runtime + generated third-party types
- `specs/third-party`: external OpenAPI YAML files
- `infra`: local infrastructure (Postgres via Docker Compose)
- `docs`: planning and product documentation

## Build, Test, and Development Commands

Run from repo root:

- `pnpm install`: install workspace dependencies
- `pnpm dev`: run all dev servers via Turbo
- `pnpm build`: build all apps/services/packages
- `pnpm lint`: run ESLint across the workspace
- `pnpm typecheck`: run TypeScript checks
- `pnpm test`: run workspace test scripts
- `pnpm gen:openapi`: generate TS clients from `specs/third-party/*.yaml`
- `docker compose -f infra/docker-compose.yml up -d`: start local Postgres

## Coding Style & Naming Conventions

- Language: TypeScript (strict)
- Formatting: Prettier (`pnpm format:write`)
- Linting: ESLint flat config via `@walt/config-eslint`
- Indentation: 2 spaces; keep files ASCII unless required
- Naming:
  - files: kebab-case (`service-health.ts`)
  - types/interfaces: PascalCase
  - variables/functions: camelCase
  - packages: `@walt/*`

## Testing Guidelines

Current scaffold includes placeholder test scripts; add tests with new features.

- Recommended: Vitest for unit/integration and Playwright for e2e (when introduced)
- Test files: `*.test.ts` or `*.spec.ts`
- Keep tests near source or in dedicated `tests/` per package
- Minimum gate before PR: `pnpm lint && pnpm typecheck && pnpm build`

## Commit & Pull Request Guidelines

Git history is not available in this workspace snapshot; use Conventional Commits:

- `feat: ...`, `fix: ...`, `chore: ...`, `refactor: ...`, `docs: ...`

PRs should include:

- clear summary and scope
- linked issue/ticket (if applicable)
- verification steps and command output summary
- screenshots/GIFs for UI changes (`apps/web`)
- notes for schema, config, or migration changes

## Role-Aware Development

Every feature must consider the role system. Permissions use CRUD operations (`read`, `create`, `update`, `delete`) per resource.

### Roles (in order of privilege)

| Role      | Access                                                            |
|-----------|-------------------------------------------------------------------|
| `owner`   | Full CRUD on all resources                                        |
| `manager` | Full CRUD except admin                                            |
| `agent`   | Inbox, tasks, reservations, checklists, contacts (full CRUD)      |
| `cleaner` | Checklists (read + update only), today (read only)                |
| `viewer`  | Today (read only)                                                 |

### Permission format

Permissions follow the pattern `resource.action`:
- `inbox.read`, `inbox.create`
- `tasks.read`, `tasks.create`, `tasks.update`, `tasks.delete`
- `checklists.read`, `checklists.create`, `checklists.update`, `checklists.delete`
- etc.

A cleaner can `checklists.read` and `checklists.update` (execute items) but cannot `checklists.create` or `checklists.delete`.

### When adding a new page or feature:

1. **Define permissions**: add `resource.action` entries to `permissionValues` in `packages/contracts/src/auth.ts`
2. **Map roles**: add the new permissions to the appropriate roles in `apps/web/src/lib/auth/permissions.ts`
3. **Route mapping**: add the API path → permission mapping in `getPermissionForApiRoute`
4. **Sidebar visibility**: add `roles` to the nav item in `apps/web/src/lib/nav-links.ts`
5. **Document access**: note which roles can use the feature in PR description

### When modifying an existing page:

- Do not widen access without explicit approval
- If a new API call is added, verify it is covered by the middleware permission check
- Map HTTP methods to CRUD: GET → read, POST → create, PATCH/PUT → update, DELETE → delete

Role definitions live in `packages/contracts/src/auth.ts`. Permission mappings live in `apps/web/src/lib/auth/permissions.ts`.

## Security & Configuration Tips

- Do not commit secrets; use `.env` files (see `.env.example`)
- Treat OpenAPI specs as source artifacts; regenerate clients after spec updates
- Prefer shared contracts in `packages/contracts` over duplicating request/response schemas
- Assume all guest/host data may contain PII (email, phone, names, addresses); collect only required fields
- Never log raw PII, auth tokens, or full request payloads; redact/mask sensitive fields in app and service logs
- Use least-privilege service access (DB/API keys scoped per service) and rotate credentials regularly
- Do not use production data in local/dev/test environments unless explicitly approved and sanitized
- Validate and sanitize all inbound data at service boundaries with shared Zod contracts
- For incidents involving possible data exposure, stop rollout and escalate immediately with an incident summary
