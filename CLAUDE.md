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
