# UI Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark custom sidebar with a light-gray shadcn Sidebar (collapsible desktop, hamburger Sheet on mobile), introduce sky-600 as the accent color via Tailwind v4 `@theme` tokens, and update the Today page to use shadcn Card components as the reference layout pattern.

**Architecture:** shadcn/ui is initialized via CLI, generating components in `apps/web/src/components/ui/`. `AppChrome` becomes a client component wrapping `SidebarProvider`. `NavSidebar` is fully rewritten as `AppSidebar` using shadcn's grouped Sidebar primitives. `nav-links.ts` is refactored from a flat array to typed `NavGroup[]` with Lucide icon references.

**Tech Stack:** Next.js 15 App Router, Tailwind v4 (`@theme` syntax), shadcn/ui, Lucide React, TypeScript, Node test runner

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/web/src/lib/nav-links.ts` | Modify | NavGroup/NavItem types + grouped data with Lucide icons |
| `apps/web/src/lib/nav-links.test.ts` | Modify | Update tests for new grouped structure |
| `apps/web/src/lib/utils.ts` | Create (shadcn) | `cn()` helper — clsx + tailwind-merge |
| `apps/web/src/components/ui/` | Create (shadcn) | sidebar, card, badge, button, sheet, avatar, separator |
| `apps/web/src/app/globals.css` | Modify | Add sky-600 accent override to shadcn @theme block |
| `apps/web/src/app/nav-sidebar.tsx` | Rewrite | AppSidebar using shadcn Sidebar primitives |
| `apps/web/src/app/app-chrome.tsx` | Modify | Add `'use client'`, SidebarProvider + SidebarInset, remove bottom nav |
| `apps/web/src/app/today/page.tsx` | Modify | Replace raw divs with shadcn Card components |
| `apps/web/components.json` | Create (shadcn) | shadcn config |
| `docs/ui-standards.md` | Create | UI standards reference doc |
| `CLAUDE.md` | Modify | Add UI Standards section |

---

## Task 1: Initialize shadcn/ui

**Files:**
- Create: `apps/web/components.json`
- Create: `apps/web/src/lib/utils.ts`
- Create: `apps/web/src/components/ui/` (multiple files)
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Run shadcn init from the web app directory**

```bash
cd /path/to/host-ai/apps/web
npx shadcn@latest init --defaults
```

If prompted interactively, answer:
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**

This will:
- Create `components.json`
- Create `src/lib/utils.ts` with the `cn()` helper
- Rewrite `globals.css` to add an `@theme` block with shadcn's color tokens
- Add runtime dependencies to `package.json`: `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`

- [ ] **Step 2: Install the required shadcn components**

```bash
npx shadcn@latest add sidebar card badge button sheet avatar separator
```

This generates files in `src/components/ui/`: `sidebar.tsx`, `card.tsx`, `badge.tsx`, `button.tsx`, `sheet.tsx`, `avatar.tsx`, `separator.tsx`.

- [ ] **Step 3: Install new dependencies**

```bash
pnpm install
```

- [ ] **Step 4: Verify typecheck passes after install**

```bash
pnpm turbo run typecheck --filter=@walt/web
```

Expected: passes (or only pre-existing errors, none from new files).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components.json apps/web/src/lib/utils.ts apps/web/src/components/ui apps/web/package.json pnpm-lock.yaml
git commit -m "chore: initialize shadcn/ui with sidebar, card, badge, button, sheet, avatar, separator"
```

---

## Task 2: Override globals.css color tokens

**Files:**
- Modify: `apps/web/src/app/globals.css`

After shadcn init, `globals.css` will have an `@theme` block using `oklch` values for its default colors. We override the `primary` and `ring` to use sky-600.

- [ ] **Step 1: Open `apps/web/src/app/globals.css` and locate the `@theme` block**

shadcn generates something like:
```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: oklch(...);
  --color-foreground: oklch(...);
  --color-primary: oklch(...);   ← override this
  --color-primary-foreground: oklch(...);
  --color-ring: oklch(...);      ← override this
  /* ... many more ... */
}
```

- [ ] **Step 2: Override `--color-primary` and `--color-ring` to sky-600**

Within the existing `@theme inline` block, update these two variables (do not add a second `@theme` block):

```css
--color-primary: #0284c7;           /* sky-600 */
--color-primary-foreground: #ffffff;
--color-ring: #0284c7;
```

Also add sidebar-specific tokens inside the same block:
```css
--color-sidebar: #ffffff;
--color-sidebar-foreground: #0f172a;
--color-sidebar-border: #e2e8f0;
--color-sidebar-accent: #f0f9ff;
--color-sidebar-accent-foreground: #0284c7;
--color-sidebar-primary: #0284c7;
--color-sidebar-primary-foreground: #ffffff;
--color-sidebar-ring: #0284c7;
```

- [ ] **Step 3: Verify build still compiles**

```bash
pnpm turbo run typecheck --filter=@walt/web
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): add sky-600 accent and sidebar color tokens to @theme"
```

---

## Task 3: Refactor nav-links.ts to grouped structure

**Files:**
- Modify: `apps/web/src/lib/nav-links.ts`
- Modify: `apps/web/src/lib/nav-links.test.ts`

The current file exports a flat `navLinks: readonly NavLink[]`. We replace it with `navGroups: NavGroup[]`. The old `navLinks` export is removed (its only consumers are `app-chrome.tsx` and `nav-sidebar.tsx`, both of which are rewritten in Tasks 4–5).

- [ ] **Step 1: Update the failing tests first**

Replace `apps/web/src/lib/nav-links.test.ts` entirely:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { navGroups } from './nav-links';

void test('navGroups has four groups', () => {
  assert.equal(navGroups.length, 4);
});

void test('first group is Overview with Today as first item', () => {
  const overview = navGroups[0];
  assert.equal(overview?.label, 'Overview');
  assert.equal(overview?.items[0]?.href, '/today');
  assert.equal(overview?.items[0]?.label, 'Today');
});

void test('Operations group contains Properties', () => {
  const ops = navGroups.find((g) => g.label === 'Operations');
  assert.ok(ops, 'Operations group exists');
  assert.ok(ops.items.some((i) => i.href === '/properties'));
});

void test('System group contains Settings and Admin', () => {
  const sys = navGroups.find((g) => g.label === 'System');
  assert.ok(sys, 'System group exists');
  assert.ok(sys.items.some((i) => i.href === '/settings'));
  assert.ok(sys.items.some((i) => i.href === '/admin/vendors'));
});

void test('all items have an icon', () => {
  for (const group of navGroups) {
    for (const item of group.items) {
      assert.ok(item.icon, `${item.label} has an icon`);
    }
  }
});
```

- [ ] **Step 2: Run the tests — verify they fail**

```bash
cd apps/web && NODE_ENV=test tsx --test src/lib/nav-links.test.ts
```

Expected: fail with "navGroups is not exported" or similar.

- [ ] **Step 3: Rewrite `apps/web/src/lib/nav-links.ts`**

```ts
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Inbox,
  CheckSquare,
  CalendarDays,
  Building2,
  ClipboardList,
  BookUser,
  Search,
  HelpCircle,
  Settings,
  Wrench,
} from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Today', href: '/today', icon: Home },
      { label: 'Inbox', href: '/inbox', icon: Inbox },
      { label: 'Tasks', href: '/tasks', icon: CheckSquare },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Reservations', href: '/reservations', icon: CalendarDays },
      { label: 'Properties', href: '/properties', icon: Building2 },
      { label: 'Checklists', href: '/property-checklists', icon: ClipboardList },
      { label: 'Contacts', href: '/contacts', icon: BookUser },
    ],
  },
  {
    label: 'Content',
    items: [
      { label: 'SEO Drafts', href: '/seo-drafts', icon: Search },
      { label: 'Questions', href: '/questions', icon: HelpCircle },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings },
      { label: 'Admin', href: '/admin/vendors', icon: Wrench },
    ],
  },
];
```

- [ ] **Step 4: Run the tests — verify they pass**

```bash
cd apps/web && NODE_ENV=test tsx --test src/lib/nav-links.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/nav-links.ts apps/web/src/lib/nav-links.test.ts
git commit -m "feat(web): refactor nav-links to grouped NavGroup structure with Lucide icons"
```

---

## Task 4: Rewrite nav-sidebar.tsx as AppSidebar

**Files:**
- Rewrite: `apps/web/src/app/nav-sidebar.tsx`

The current sidebar is a dark `<aside>` with manual collapse state. Replace it entirely with shadcn's Sidebar primitives. The component now accepts `linkComponent` and `userButton` props to keep the existing injection pattern for tests.

- [ ] **Step 1: Rewrite `apps/web/src/app/nav-sidebar.tsx`**

```tsx
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { navGroups } from '@/lib/nav-links';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';

type NavLinkComponentProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

type AppSidebarProps = {
  linkComponent?: ComponentType<NavLinkComponentProps>;
  userButton?: ReactNode;
};

function CollapseToggle() {
  const { open } = useSidebar();
  return (
    <SidebarTrigger className="-ml-1 text-slate-400 hover:text-slate-600">
      {open ? (
        <PanelLeftClose className="h-4 w-4" />
      ) : (
        <PanelLeftOpen className="h-4 w-4" />
      )}
    </SidebarTrigger>
  );
}

export function AppSidebar({
  linkComponent: NavLink = Link,
  userButton,
}: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold tracking-tight text-slate-900 group-data-[collapsible=icon]:hidden">
            Walt AI
          </span>
          <CollapseToggle />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon: LucideIcon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <NavLink href={item.href}>
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {userButton && (
        <SidebarFooter className="border-t border-sidebar-border p-3">
          {userButton}
        </SidebarFooter>
      )}

      <SidebarRail />
    </Sidebar>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm turbo run typecheck --filter=@walt/web
```

Fix any TypeScript errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/nav-sidebar.tsx
git commit -m "feat(web): rewrite nav-sidebar as AppSidebar using shadcn Sidebar primitives"
```

---

## Task 5: Update AppChrome to use SidebarProvider + SidebarInset

**Files:**
- Modify: `apps/web/src/app/app-chrome.tsx`

This is the main layout shell. We:
1. Add `'use client'` (required for `SidebarProvider`)
2. Wrap content in `SidebarProvider` → `SidebarInset`
3. Add a topbar with `SidebarTrigger` (mobile hamburger) + page title area
4. Remove the old mobile bottom nav bar and old mobile header
5. Import `AppSidebar` instead of `NavSidebar`
6. Keep the `isAuthenticated`, `LinkComponent`, `UserButtonComponent` props intact

- [ ] **Step 1: Rewrite `apps/web/src/app/app-chrome.tsx`**

```tsx
'use client';

import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import { Menu } from 'lucide-react';

import { AppSidebar } from './nav-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';

type NavLinkComponentProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

type UserButtonComponentProps = Record<string, never>;

type AppChromeProps = {
  children: ReactNode;
  isAuthenticated: boolean;
  LinkComponent?: ComponentType<NavLinkComponentProps>;
  UserButtonComponent?: ComponentType<UserButtonComponentProps>;
};

export function AppChrome({
  children,
  isAuthenticated,
  LinkComponent = Link,
  UserButtonComponent = UserButton,
}: AppChromeProps) {
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <AppSidebar
        linkComponent={LinkComponent}
        userButton={<UserButtonComponent />}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-white px-4">
          <SidebarTrigger className="text-slate-400 hover:text-slate-600 md:hidden">
            <Menu className="h-5 w-5" />
          </SidebarTrigger>
          <div className="flex flex-1 items-center justify-between">
            {/* Page title and actions are rendered by each page via a layout slot or directly */}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50 p-5">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm turbo run typecheck --filter=@walt/web
```

Fix any TypeScript errors.

- [ ] **Step 3: Run lint**

```bash
pnpm turbo run lint --filter=@walt/web
```

Fix any lint errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/app-chrome.tsx
git commit -m "feat(web): update AppChrome with SidebarProvider, SidebarInset, remove mobile bottom nav"
```

---

## Task 6: Update Today page to use Card layout pattern

**Files:**
- Modify: `apps/web/src/app/today/page.tsx`

`today/page.tsx` is a server component (no `'use client'`). shadcn `Card`, `CardHeader`, `CardContent`, `CardTitle`, and `Badge` are all purely presentational (no hooks), so they work fine in server components.

- [ ] **Step 1: Rewrite the JSX in `apps/web/src/app/today/page.tsx`**

Keep all data-fetching functions (`getTurnovers`, `getTasksFromGateway`) unchanged. Only update the returned JSX inside `TodayPage`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CalendarArrowDown,
  CalendarArrowUp,
  CheckSquare,
  Thermometer,
  Circle,
} from 'lucide-react';

// ... (keep existing data-fetching functions unchanged) ...

export default async function TodayPage() {
  const auth = await getAuthContext();
  if (!auth) return null;

  const [turnovers, tasks, poolTemps] = await Promise.all([
    getTurnovers(auth.orgId),
    getTasksFromGateway(auth.orgId),
    getPoolTemperatures(auth.orgId),
  ]);

  const checkouts = turnovers.filter((t) => !t.arrivalDate || t.departureDate);
  const checkins = turnovers.filter((t) => t.arrivalDate);

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Chicago',
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Today</h1>
        <p className="text-sm text-slate-500">{dateLabel}</p>
      </div>

      <SuggestionsStack />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
              <CalendarArrowDown className="h-4 w-4 text-sky-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{turnovers.filter(t => t.departureDate).length}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Check-outs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
              <CalendarArrowUp className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{turnovers.filter(t => t.arrivalDate).length}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Check-ins</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <CheckSquare className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{tasks.length}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Tasks Due</div>
          </CardContent>
        </Card>
        {poolTemps.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                <Thermometer className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{poolTemps.length}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Pool Temps</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pool Temperatures */}
      {poolTemps.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Thermometer className="h-4 w-4 text-slate-400" />
              Pool Temperatures
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3 overflow-x-auto px-4 pb-4">
            {poolTemps.map((pool) => (
              <div
                key={pool.propertyId}
                className="min-w-[140px] shrink-0 rounded-lg border border-slate-100 bg-slate-50 p-3"
              >
                <div className="truncate text-sm font-medium text-slate-900">{pool.propertyName}</div>
                <div className="mt-1 text-2xl font-bold text-sky-600">
                  {pool.temperatureF !== null ? `${pool.temperatureF}°F` : '—'}
                </div>
                {pool.asOf && (
                  <div className="mt-1 text-xs text-slate-400">
                    as of{' '}
                    {pool.asOf.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZone: 'America/Chicago',
                    })}
                  </div>
                )}
                {!pool.pumpRunning && (
                  <Badge variant="secondary" className="mt-2 text-xs">Pump off</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Turnovers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <CalendarArrowDown className="h-4 w-4 text-slate-400" />
            Turnovers Today
          </CardTitle>
          <Badge variant="secondary">{turnovers.length}</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {turnovers.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No turnovers today.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {turnovers.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{t.propertyName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {t.guestFirstName} {t.guestLastName}
                      {t.departureDate &&
                        ` · Out ${new Date(t.departureDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })}`}
                      {t.arrivalDate &&
                        ` · In ${new Date(t.arrivalDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })}`}
                    </div>
                  </div>
                  <Badge variant={t.arrivalDate && t.departureDate ? 'secondary' : t.arrivalDate ? 'default' : 'outline'}>
                    {t.arrivalDate && t.departureDate ? 'Turnover' : t.arrivalDate ? 'Check-in' : 'Check-out'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <CheckSquare className="h-4 w-4 text-slate-400" />
            Tasks Due Today
          </CardTitle>
          <Badge variant="secondary">{tasks.length}</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No tasks due today.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(tasks as Array<{ id: string; title: string; priority: string }>).map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                  <Circle
                    className={`h-3 w-3 shrink-0 ${task.priority === 'high' ? 'text-red-500 fill-red-500' : 'text-slate-300 fill-slate-300'}`}
                  />
                  <span className="text-sm text-slate-900">{task.title}</span>
                  {task.priority === 'high' && (
                    <Badge variant="destructive" className="ml-auto text-xs">High</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm turbo run typecheck --filter=@walt/web
```

Fix any TypeScript errors (most likely: verify Lucide icon names exist — check https://lucide.dev/icons/ if uncertain).

- [ ] **Step 3: Run lint**

```bash
pnpm turbo run lint --filter=@walt/web
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/today/page.tsx
git commit -m "feat(web): update Today page to use shadcn Card layout pattern"
```

---

## Task 7: Full verification (typecheck + lint + build)

**Files:** none changed

- [ ] **Step 1: Run the full check suite**

```bash
pnpm turbo run typecheck lint build --filter=@walt/web
```

Expected: all pass with zero errors and zero warnings.

- [ ] **Step 2: Run the existing test suite**

```bash
cd apps/web && NODE_ENV=test tsx --test src/**/*.test.ts
```

Expected: all tests pass, including the updated `nav-links.test.ts`.

- [ ] **Step 3: Fix any failures before proceeding**

Do not move on to Task 8 if typecheck, lint, build, or tests fail.

---

## Task 8: Write docs/ui-standards.md

**Files:**
- Create: `docs/ui-standards.md`

- [ ] **Step 1: Create `docs/ui-standards.md`**

```markdown
# Walt AI — UI Standards

This is the canonical reference for UI patterns in the Walt AI web application. All new UI code must follow these standards. When in doubt, look at `apps/web/src/app/today/page.tsx` as the reference implementation.

---

## Color Tokens

Defined in `apps/web/src/app/globals.css` via Tailwind v4 `@theme`. **Never** hardcode hex values or use bare RGB channel variables.

| Token | Tailwind class | Hex | Use |
|---|---|---|---|
| Primary / Accent | `bg-primary` / `text-primary` | `#0284c7` (sky-600) | Buttons, active nav, links |
| Background | `bg-background` | `#f8fafc` (slate-50) | Page background |
| Card | `bg-card` | `#ffffff` | Card backgrounds |
| Border | `border-border` | `#e2e8f0` (slate-200) | Card/input borders |
| Muted | `bg-muted` / `text-muted-foreground` | `#f1f5f9` / `#64748b` | Subtle backgrounds, secondary text |
| Sidebar | `bg-sidebar` | `#ffffff` | Sidebar background |

**The only accent color is sky-600 (#0284c7). Never use green, teal, or turquoise as an accent.**

---

## Typography

| Use | Classes |
|---|---|
| Page title | `text-xl font-bold text-slate-900` |
| Page subtitle | `text-sm text-slate-500` |
| Card title | `text-sm font-semibold text-slate-900` |
| Body text | `text-sm text-slate-900` |
| Secondary text | `text-sm text-slate-500` |
| Muted / timestamp | `text-xs text-slate-400` |
| Section label (uppercase) | `text-xs font-semibold uppercase tracking-wide text-slate-400` |

---

## Sidebar

- **Always** use the shadcn `Sidebar` component from `@/components/ui/sidebar`.
- **Never** re-implement navigation with a custom `<aside>` or `<nav>`.
- The canonical implementation is `apps/web/src/app/nav-sidebar.tsx`.
- Navigation groups are defined in `apps/web/src/lib/nav-links.ts` as `navGroups: NavGroup[]`. Add new routes there.
- The sidebar is collapsible to icon-only mode on desktop; it becomes a Sheet drawer on mobile.

---

## Cards

All content sections use shadcn `Card`. **Never** use a raw `<div>` with manual `border`, `rounded-*`, and `bg-white` to create a content area.

```tsx
// ✅ Correct
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
      <SomeIcon className="h-4 w-4 text-slate-400" />
      Section Title
    </CardTitle>
    <Badge variant="secondary">count</Badge>
  </CardHeader>
  <CardContent className="p-0">
    {/* content */}
  </CardContent>
</Card>

// ❌ Wrong
<div className="rounded-lg border border-gray-200 bg-white p-4">
  ...
</div>
```

---

## Badges

Use shadcn `Badge` from `@/components/ui/badge`.

| Variant | When to use |
|---|---|
| `default` | Primary action labels (sky-600 bg) |
| `secondary` | Neutral counts, statuses (slate bg) |
| `outline` | Subtle labels (white bg, border) |
| `destructive` | Errors, overdue, high priority (red) |

---

## Buttons

Use shadcn `Button` from `@/components/ui/button`.

| Variant | When to use |
|---|---|
| `default` | Primary actions (sky-600) |
| `outline` | Secondary actions |
| `ghost` | Subtle / icon-only buttons |
| `destructive` | Dangerous/irreversible actions |

---

## Icons

Use **Lucide React** for all icons. It ships with shadcn and requires no extra installation.

```tsx
// ✅ Correct
import { Home, Inbox } from 'lucide-react';
<Home className="h-4 w-4" />

// ❌ Wrong — do not add Font Awesome
<i className="fa-solid fa-house" />
```

**Sizing:** Always `h-4 w-4` for inline/nav icons. Use `h-5 w-5` sparingly for prominent standalone icons.

**Color:** Nav icons use `text-slate-400` at rest; the active state is handled automatically by `SidebarMenuButton`. Domain icons in card headers use `text-slate-400`. Stat card icons use a colored variant matching their semantic color.

---

## Spacing

| Context | Classes |
|---|---|
| Page padding (main content area) | `p-5` (set by AppChrome's `<main>`) |
| Card header padding | `px-4 py-3` |
| Card content (list items) | `px-4 py-3` per item, `divide-y divide-slate-100` between items |
| Card content (padding variant) | `p-4` when content needs uniform padding |
| Page section gap | `space-y-5` or `gap-5` grid |
| Stat card grid | `grid grid-cols-2 gap-3 sm:grid-cols-4` |

---

## Do / Don't Examples

### Cards

```tsx
// ✅ Use shadcn Card
<Card>
  <CardHeader className="px-4 py-3">
    <CardTitle className="text-sm font-semibold">Turnovers</CardTitle>
  </CardHeader>
  <CardContent className="p-0">...</CardContent>
</Card>

// ❌ Raw div acting as a card
<div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4">
  <h2 className="font-semibold">Turnovers</h2>
  ...
</div>
```

### Icons

```tsx
// ✅ Lucide React
import { CalendarDays } from 'lucide-react';
<CalendarDays className="h-4 w-4 text-slate-400" />

// ❌ Font Awesome class string
<i className="fas fa-calendar text-gray-400" />
```

### Accent Color

```tsx
// ✅ Use primary token or sky-600
<button className="bg-primary text-primary-foreground">Save</button>
<span className="text-sky-600">Active</span>

// ❌ Using green or teal
<button className="bg-emerald-600">Save</button>
<span className="text-teal-500">Active</span>
```

---

## Adding New shadcn Components

```bash
cd apps/web
npx shadcn@latest add <component-name>
```

Components land in `apps/web/src/components/ui/`. They are project-owned code — edit them as needed.
```

- [ ] **Step 2: Commit**

```bash
git add docs/ui-standards.md
git commit -m "docs: add UI standards reference document"
```

---

## Task 9: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Append the UI Standards section to `CLAUDE.md`**

Add this block at the end of the file:

```markdown
## UI Standards

See `docs/ui-standards.md` for full reference. Key rules:

- **Accent color**: `sky-600` (#0284c7). Never use green or teal as an accent.
- **Cards**: Use shadcn `Card` / `CardHeader` / `CardContent` for all content sections. Do not use raw `<div>` with manual border + background for content areas.
- **Sidebar**: Use the shadcn `Sidebar` component from `@/components/ui/sidebar`. Do not re-implement navigation manually. Navigation routes are defined in `apps/web/src/lib/nav-links.ts` as `navGroups`.
- **Icons**: Use Lucide React for all icons (`<IconName className="h-4 w-4" />`). It ships with shadcn — no extra install needed. Do not add Font Awesome.
- **Tailwind tokens**: Use `@theme` CSS custom properties (Tailwind v4 syntax). Never use bare RGB channel variables.
- **Component location**: shadcn components live in `apps/web/src/components/ui/`. Add new shadcn components with `npx shadcn@latest add <component>` from the `apps/web/` directory.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add UI Standards section to CLAUDE.md"
```

---

## Final Checklist

Before considering this complete:

- [ ] `pnpm turbo run typecheck lint build --filter=@walt/web` — zero errors, zero warnings
- [ ] `cd apps/web && NODE_ENV=test tsx --test src/**/*.test.ts` — all tests pass
- [ ] Sidebar renders with correct grouped nav, sky-600 active state, Lucide icons
- [ ] Sidebar collapses to icon-only on desktop; tooltip appears on hover
- [ ] Mobile hamburger triggers Sheet overlay from the left
- [ ] Mobile bottom nav bar is gone
- [ ] Today page uses shadcn Cards for all sections
- [ ] `docs/ui-standards.md` exists with all 9 required sections
- [ ] `CLAUDE.md` has the UI Standards section
