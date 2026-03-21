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

## UI Standards

See `docs/ui-standards.md` for full reference. Key rules:

- **Accent color**: `sky-600` (#0284c7). Never use green or teal as an accent.
- **Cards**: Use shadcn `Card` / `CardHeader` / `CardContent` for all content sections. Do not use raw `<div>` with manual border + background for content areas.
- **Sidebar**: Use the shadcn `Sidebar` component from `@/components/ui/sidebar`. Do not re-implement navigation manually. Navigation routes are defined in `apps/web/src/lib/nav-links.ts` as `navGroups`.
- **Icons**: Use Lucide React for all icons (`<IconName className="h-4 w-4" />`). It ships with shadcn — no extra install needed. Do not add Font Awesome.
- **Tailwind tokens**: Use `@theme` CSS custom properties (Tailwind v4 syntax). Never use bare RGB channel variables.
- **Component location**: shadcn components live in `apps/web/src/components/ui/`. Add new shadcn components with `npx shadcn@latest add <component>` from the `apps/web/` directory.
