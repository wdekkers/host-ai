# Claude Code – Project Guidelines

## Before raising a PR

Always run the following and ensure they all pass before pushing or creating a pull request:

```bash
pnpm turbo run typecheck lint build --filter=@walt/web
```

Or to check the full monorepo:

```bash
pnpm turbo run typecheck lint
```

Fix any errors before opening a PR. Do not raise a PR with a failing typecheck, lint, or build.

### Clean PRs from clean branches

Never create a PR from a long-lived feature branch that has accumulated unrelated commits. Before creating a PR:

1. **Create a new branch from `origin/main`** for the specific change (e.g. `fix/inbox-sort-order`, not reusing `feat/big-feature-branch`).
2. **Cherry-pick or re-apply only the relevant commits** — do not include unrelated work.
3. **Verify the diff** with `git log --oneline origin/main..HEAD` and `git diff --stat origin/main..HEAD` before running `gh pr create`. The PR should contain only files related to the change described in the title.
4. **Do not include auto-generated snapshot files** (e.g. Drizzle `*_snapshot.json`) in hand-written migrations.

## Next.js route files

Route files (`route.ts`) may only export HTTP method handlers: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`.

Any other functions (e.g. `handleFoo`) must live in a sibling `handler.ts` file and be imported from there — both by the route file and by test files.

```
api/
  my-feature/
    handler.ts   ← business logic + exported handler functions
    route.ts     ← only exports GET, POST, etc. (imports from handler.ts)
    route.test.ts ← imports handlers from handler.ts
```

## Database schema

Do not declare the same table variable more than once in `packages/db/src/schema.ts`. If a table already exists, update the existing definition rather than adding a new one.

## UI Standards

See `docs/ui-standards.md` for full reference. Key rules:

- **Accent color**: `sky-600` (#0284c7). Never use green or teal as an accent.
- **Cards**: Use shadcn `Card` / `CardHeader` / `CardContent` for all content sections. Do not use raw `<div>` with manual border + background for content areas.
- **Sidebar**: Use the shadcn `Sidebar` component from `@/components/ui/sidebar`. Do not re-implement navigation manually. Navigation routes are defined in `apps/web/src/lib/nav-links.ts` as `navGroups`.
- **Icons**: Use Lucide React for all icons (`<IconName className="h-4 w-4" />`). It ships with shadcn — no extra install needed. Do not add Font Awesome.
- **Tailwind tokens**: Use `@theme` CSS custom properties (Tailwind v4 syntax). Never use bare RGB channel variables.
- **Component location**: shadcn components live in `apps/web/src/components/ui/`. Add new shadcn components with `npx shadcn@latest add <component>` from the `apps/web/` directory.

## Architecture: Microservices & Shared Packages

### Principle

The Next.js app (`apps/web`) is a **thin orchestration layer** — it handles auth, renders UI, and calls backend services. It must NOT contain direct business logic or raw third-party API calls.

All third-party integrations must live in **dedicated packages** under `packages/`. Each package wraps one external service and exposes a typed client. The Next.js app (and any future service) imports and calls these packages rather than using SDKs or `fetch()` directly.

### Package structure for integrations

```
packages/
  hospitable/       ← @walt/hospitable – Hospitable API client
  twilio/           ← @walt/twilio – Twilio SMS/voice client
  resend/           ← @walt/resend – Resend email client
  ai/               ← @walt/ai – OpenAI + Anthropic wrappers (classify, score, suggest, etc.)
  ring-client/      ← @walt/ring-client – Ring IoT (already exists)
  db/               ← @walt/db – Drizzle schema (already exists)
  contracts/        ← @walt/contracts – Shared Zod schemas & types (already exists)
  api-client/       ← @walt/api-client – Generated OpenAPI clients (already exists)
```

### Rules

1. **No direct third-party SDK usage in `apps/web`**. Do not `import Twilio from 'twilio'`, `import OpenAI from 'openai'`, `import { Resend } from 'resend'`, or raw `fetch()` to Hospitable in any route or lib file inside `apps/web`. Instead, import from the corresponding `@walt/*` package.
2. **Each integration package** must:
   - Export a typed client class or factory function
   - Use Zod schemas for all request/response validation
   - Define its own env config with Zod validation (like `integrations-env.ts` pattern)
   - Have its own `package.json` with the third-party SDK as a dependency
3. **New integrations** (e.g., ReiHub) must be created as a new package first, then consumed by the app or service that needs them.
4. **The gateway (`apps/gateway`)** is the entry point for inter-service communication. When `apps/web` needs to call the messaging or tasks microservice, it goes through the gateway — never direct service-to-service calls from the web app.

### Next.js route handler pattern

Route handlers in `apps/web` should follow this flow:

```
Request → Auth check → Validate input (Zod) → Call @walt/* package or gateway → Return response
```

They should NOT:
- Instantiate third-party SDK clients
- Contain API-call logic (pagination, retries, auth headers)
- Define data transformation/normalization logic (that belongs in the package)

## Zod & TypeScript Standards

### Zod usage

- **All API boundaries** (route inputs, external API responses, env config) must be validated with Zod schemas.
- **Use `.safeParse()`** for external/untrusted input (webhooks, user input) so errors can be handled gracefully. Use `.parse()` only for internal/trusted data where a throw is acceptable.
- **Shared schemas** belong in `@walt/contracts`. Route-specific request schemas can live in the route's `handler.ts` file but must still use Zod.
- **Derive TypeScript types from Zod schemas** using `z.infer<typeof schema>` — do not manually duplicate types alongside schemas.
- **Colocate schemas with the package that owns the data.** For example, Hospitable response schemas belong in `@walt/hospitable`, not in `@walt/contracts`. `@walt/contracts` is for cross-service shared types (DTOs, events, shared enums).

### TypeScript usage

- **Strict mode** — no `any` types. Use `unknown` and narrow with type guards or Zod parsing.
- **Prefer `satisfies`** over `as` for type assertions where possible.
- **Return types on exported functions** — always declare explicit return types on public/exported functions.
- **No implicit `any`** from untyped libraries — add `@types/*` or write a `.d.ts` declaration.
