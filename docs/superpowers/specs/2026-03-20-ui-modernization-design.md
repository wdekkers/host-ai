# UI Modernization Design Spec
**Date:** 2026-03-20
**Status:** Approved

## Overview

Modernize the Walt AI web application UI to adopt a Hostaway-inspired light gray aesthetic with a sky blue accent, a fully reworked sidebar with collapsible desktop / hamburger mobile behavior, and consistent card-based page layouts. Establish shadcn/ui + Radix UI as the component foundation going forward.

---

## Decisions Made

| Decision | Choice |
|---|---|
| Accent color | Sky blue — Tailwind `sky-600` (#0284c7) |
| Sidebar default (desktop) | Fixed, always visible, 220px |
| Sidebar collapsed state | Icon-only, 52px |
| Mobile nav | Hamburger → shadcn Sheet slide-in overlay (replaces existing mobile bottom nav bar) |
| Nav icons | Lucide React (already a shadcn dependency; grayscale at rest, sky-600 when active) |
| Component foundation | shadcn/ui (init via CLI) + Radix UI primitives |
| Page background | `slate-50` (#f8fafc) |
| Sidebar background | White with `slate-200` right border |
| Card background | White, `slate-200` border, `rounded-xl` |

---

## Architecture

### shadcn/ui Installation

Run the shadcn CLI for Tailwind v4 (this rewrites `globals.css` to use `@theme` syntax and creates `components.json`):

```bash
npx shadcn@latest init
```

Answer prompts:
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**

Then add individual components:

```bash
npx shadcn@latest add sidebar card badge button sheet avatar separator
```

shadcn is a **code-generation tool, not a runtime package**. The generated components land in `apps/web/src/components/ui/` and are owned by the project. The `shadcn` package itself is not added to `package.json` as a runtime dependency — but the following runtime dependencies are added:

- `@radix-ui/react-*` (pulled in by shadcn components)
- `class-variance-authority`
- `clsx`
- `tailwind-merge`
- `lucide-react` (used internally by shadcn components — see Icons note below)

### Color Tokens (Tailwind v4 `@theme`)

Tailwind v4 uses `@theme` in `globals.css` to register custom color tokens. **Do not use bare RGB channel variables** (that is the v3 pattern and does not work in v4). Use complete color values:

```css
@import "tailwindcss";

@theme {
  --color-accent: #0284c7;           /* sky-600 */
  --color-accent-foreground: #ffffff;
  --color-sidebar: #ffffff;
  --color-background: #f8fafc;       /* slate-50 */
  --color-card: #ffffff;
  --color-card-foreground: #0f172a;  /* slate-900 */
  --color-muted: #f1f5f9;            /* slate-100 */
  --color-muted-foreground: #64748b; /* slate-500 */
  --color-border: #e2e8f0;           /* slate-200 */
}
```

shadcn's `init` will add its own variable block using `oklch` values. Merge the above accent overrides into that block, replacing shadcn's default primary with sky-600.

### Icons: Lucide React (single system)

Use **Lucide React** for all icons throughout the app — both nav items and shadcn component internals. Lucide is already installed as a shadcn dependency (tree-shakable, no CDN needed). Import icons as named React components:

```tsx
import { Home, Inbox, CheckSquare, CalendarDays, Building2,
         ClipboardList, BookUser, Search, HelpCircle,
         Settings, Wrench, PanelLeftClose, PanelLeftOpen, Menu } from 'lucide-react'
```

Render with: `<Home className="h-4 w-4" />` (always size via `h-4 w-4` for nav icons).

No Font Awesome CDN link is needed. If Font Awesome classes exist elsewhere in the codebase they can be migrated to Lucide in a follow-up pass — do not mix systems going forward.

### Sidebar Structure

`apps/web/src/app/nav-sidebar.tsx` is a full rewrite using shadcn `Sidebar` components. The file keeps `'use client'` (it already is client-side).

**Navigation groups** — source of truth for hrefs remains `apps/web/src/lib/nav-links.ts`. That file is updated to match this group structure:

| Group label | Items (label → href → Lucide icon) |
|---|---|
| Overview | Today → `/today` → `Home`; Inbox → `/inbox` → `Inbox`; Tasks → `/tasks` → `CheckSquare` |
| Operations | Reservations → `/reservations` → `CalendarDays`; Properties → `/properties` → `Building2`; Checklists → `/property-checklists` → `ClipboardList`; Contacts → `/contacts` → `BookUser` |
| Content | SEO Drafts → `/seo-drafts` → `Search`; Questions → `/questions` → `HelpCircle` |
| System | Settings → `/settings` → `Settings`; Admin → `/admin/vendors` → `Wrench` |

The `nav-links.ts` file is updated to the following TypeScript shape:

```ts
export type NavItem = { label: string; href: string; icon: LucideIcon }
export type NavGroup = { label: string; items: NavItem[] }
export const navGroups: NavGroup[] = [ /* ... */ ]
```

Import `LucideIcon` from `'lucide-react'`. Nav items are rendered in `nav-sidebar.tsx` as:

```tsx
<Icon className="h-4 w-4 shrink-0 text-slate-400 group-data-[active=true]:text-sky-600" />
```

**Collapse behavior:**
- Desktop collapse toggle uses `PanelLeftClose` (expanded) / `PanelLeftOpen` (collapsed) from Lucide
- Collapse state persisted via `SidebarProvider` (uses cookie/localStorage internally)
- At 52px collapsed width: group labels hidden, item text labels hidden, icons centered; tooltip shown on hover with item label
- Transition: `transition-[width] duration-200 ease-in-out`

**Mobile behavior:**
- Below `md` breakpoint, sidebar is hidden entirely
- The existing **mobile bottom nav bar** in `app-chrome.tsx` is **removed**
- A `SidebarTrigger` (hamburger) is shown in the topbar on mobile
- Tapping opens a shadcn `Sheet` from the left containing full sidebar content

### `cn()` utility helper

`apps/web/src/lib/utils.ts` is a new file (shadcn generates this). Contents:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### AppChrome / SidebarProvider placement

`SidebarProvider` lives in `apps/web/src/app/app-chrome.tsx`, **not** in `layout.tsx`. Ensure `app-chrome.tsx` has `'use client'` at the top (add it if missing). `layout.tsx` remains a server component and is **not changed** by this work.

Collapse state: `SidebarProvider` handles persistence automatically via a cookie (`sidebar:state`). No additional configuration needed.

The `AppChrome` component currently accepts `LinkComponent` and `UserButtonComponent` injection props (used in tests). **Keep this interface intact.** Pass both props into `AppSidebar`:

```tsx
// app-chrome.tsx
<SidebarProvider>
  <AppSidebar linkComponent={LinkComponent} userButton={UserButtonComponent} />
  <SidebarInset>...</SidebarInset>
</SidebarProvider>

// nav-sidebar.tsx — AppSidebar props
type AppSidebarProps = {
  linkComponent?: React.ComponentType<{ href: string; children: React.ReactNode; className?: string }>
  userButton?: React.ReactNode
}
```

`LinkComponent` wraps each `SidebarMenuButton` for navigation. `userButton` renders in `SidebarFooter`.

Updated `AppChrome` structure:

```
SidebarProvider        ← added in app-chrome.tsx
  AppSidebar           ← nav-sidebar.tsx (full rewrite)
  SidebarInset
    header (white, h-14, border-b border-border)
      SidebarTrigger   ← hamburger on mobile, subtle panel toggle on desktop
      page title slot
      action slot (right)
    main (flex-1, overflow-y-auto, bg-background, p-5)
      {children}
```

### Card Layout Pattern

All page content sections use shadcn `Card`. The `today/page.tsx` page is updated as the reference implementation. Other pages receive only the new shell (sidebar + topbar + background) automatically via `AppChrome`; their internal layouts are updated in a follow-up pass.

```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
      <CalendarCheck className="h-4 w-4 text-slate-400" />
      Section title
    </CardTitle>
    <Badge variant="secondary">count</Badge>
  </CardHeader>
  <CardContent className="p-0">
    {/* list items or grid content */}
  </CardContent>
</Card>
```

**Stat cards** on Today dashboard: 4-column grid, each a `Card` with a colored icon box, metric label, large value, and subtext.

### Badge Variants

| Variant | Use case | Style |
|---|---|---|
| `default` | Primary accent actions | sky-600 bg, white text |
| `secondary` | Neutral counts, statuses | slate-100 bg, slate-600 text |
| `outline` | Subtle labels | white bg, slate-200 border |
| `destructive` | Errors, overdue | red-50 bg, red-700 text |

---

## Files Changed

| File | Change |
|---|---|
| `apps/web/src/app/layout.tsx` | No changes needed (Font Awesome CDN not required; Lucide is npm) |
| `apps/web/src/app/globals.css` | shadcn `@theme` tokens + sky-600 accent override |
| `apps/web/src/app/app-chrome.tsx` | Add `SidebarProvider` + `SidebarInset`; remove mobile bottom nav bar; keep injection props interface |
| `apps/web/src/app/nav-sidebar.tsx` | Full rewrite using shadcn Sidebar components |
| `apps/web/src/lib/nav-links.ts` | Update to grouped structure with icons and correct hrefs |
| `apps/web/src/components/ui/` | New — shadcn-generated: sidebar, card, badge, button, sheet, avatar, separator |
| `apps/web/src/lib/utils.ts` | New — `cn()` helper (`clsx` + `tailwind-merge`) |
| `apps/web/src/app/today/page.tsx` | Update internals to card layout pattern (reference implementation) |
| `apps/web/components.json` | New — shadcn config (generated at `apps/web/` root by `shadcn init`) |
| `apps/web/package.json` | Add `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` |
| `docs/ui-standards.md` | New — UI standards reference |
| `CLAUDE.md` | Add "UI Standards" section |

---

## Standards Artifacts

### `docs/ui-standards.md` — sections required

1. **Color tokens** — full token table with Tailwind class names and hex values; note sky-600 as the sole accent color
2. **Typography** — heading sizes, body text, muted text; Tailwind class references
3. **Sidebar** — rules: always use shadcn `Sidebar`; never re-implement nav manually; group definitions are canonical
4. **Cards** — rule: all content sections use shadcn `Card`; no raw `<div>` with manual border/bg for content areas
5. **Badges** — variant decision table (which variant for which use case)
6. **Buttons** — primary = sky-600 filled; secondary = outline; destructive = red
7. **Icons** — Lucide React for all icons (nav + shadcn internals); always `h-4 w-4`; nav icons `text-slate-400` at rest, `text-sky-600` active; no Font Awesome going forward
8. **Spacing** — page padding (`p-5`), card internal padding, gap conventions
9. **Do / Don't examples** — at least 3 examples showing correct vs incorrect patterns

### `CLAUDE.md` addition — exact text

Add a new section after the existing content:

```markdown
## UI Standards

See `docs/ui-standards.md` for full reference. Key rules:

- **Accent color**: `sky-600` (#0284c7). Never use green or teal as an accent.
- **Cards**: Use shadcn `Card` / `CardHeader` / `CardContent` for all content sections. Do not use raw `<div>` with manual border + background for content areas.
- **Sidebar**: Use the shadcn `Sidebar` component. Do not re-implement navigation manually.
- **Icons**: Use Lucide React for all icons (`<IconName className="h-4 w-4" />`). It ships with shadcn — no extra install needed. Do not add Font Awesome.
- **Tailwind tokens**: Use `@theme` CSS custom properties (Tailwind v4 syntax). Never use bare RGB channel variables.
- **Component location**: shadcn components live in `apps/web/src/components/ui/`. Add new shadcn components with `npx shadcn@latest add <component>`.
```

---

## Out of Scope

- Internal layout updates for pages other than `today/page.tsx` (follow-up work)
- Dark mode
- Animations beyond sidebar collapse transition
- New features or data model changes
- Replacing Lucide icons inside shadcn component internals with Font Awesome equivalents
