# UI Modernization Design Spec
**Date:** 2026-03-20
**Status:** Approved

## Overview

Modernize the Walt AI web application UI to adopt a Hostaway-inspired light gray aesthetic with a sky blue accent, a fully reworked sidebar with collapsible desktop/hamburger mobile behavior, and consistent card-based page layouts. Establish shadcn/ui + Radix UI as the component foundation going forward.

---

## Decisions Made

| Decision | Choice |
|---|---|
| Accent color | Sky blue — Tailwind `sky-600` (#0284c7) |
| Sidebar default (desktop) | Fixed, always visible, 220px |
| Sidebar collapsed state | Icon-only, 52px |
| Mobile nav | Hamburger → shadcn Sheet slide-in overlay |
| Nav icons | Font Awesome 6 (grayscale at rest, sky-600 when active) |
| Component foundation | shadcn/ui + Radix UI |
| Page background | `slate-50` (#f8fafc) |
| Sidebar background | White with `slate-200` right border |
| Card background | White, `slate-200` border, `rounded-xl` |

---

## Architecture

### Component Foundation

Install shadcn/ui with the following components:
- `Sidebar` — primary nav shell (handles collapse state, keyboard nav, mobile sheet)
- `Sheet` — mobile hamburger overlay (used by shadcn Sidebar internally)
- `Card`, `CardHeader`, `CardContent`, `CardTitle` — page content sections
- `Badge` — status labels throughout
- `Button` — primary/secondary actions
- `Avatar` — user identity in sidebar footer
- `Separator` — nav group dividers

shadcn components are copy-pasted into `apps/web/src/components/ui/` and owned by the project. They use Tailwind utility classes — no runtime CSS-in-JS.

### Color Tokens

Defined in `apps/web/src/app/globals.css` as CSS custom properties wired to Tailwind:

```css
:root {
  --accent: 3 132 203;          /* sky-600 — #0284c7 */
  --accent-foreground: 255 255 255;
  --sidebar-background: 255 255 255;
  --sidebar-border: 226 232 240; /* slate-200 */
  --background: 248 250 252;     /* slate-50 */
  --card: 255 255 255;
  --card-foreground: 15 23 42;   /* slate-900 */
  --muted: 241 245 249;          /* slate-100 */
  --muted-foreground: 100 116 139; /* slate-500 */
}
```

### Sidebar Structure

`apps/web/src/app/nav-sidebar.tsx` is replaced by a shadcn Sidebar implementation. The sidebar contains:

**Header:** Walt AI logo icon + wordmark, collapse toggle button (Font Awesome `fa-sidebar` icon).

**Navigation groups** (using `SidebarGroup`, `SidebarGroupLabel`, `SidebarMenu`):

| Group | Items |
|---|---|
| Overview | Today (`fa-house`), Inbox (`fa-inbox`), Tasks (`fa-check-square`) |
| Operations | Reservations (`fa-calendar-days`), Properties (`fa-building`), Checklists (`fa-clipboard-list`), Contacts (`fa-address-book`) |
| Content | SEO Drafts (`fa-magnifying-glass`), Questions (`fa-circle-question`) |
| System | Settings (`fa-gear`), Admin (`fa-screwdriver-wrench`) |

**Footer:** Clerk `UserButton` wrapped in a sidebar footer row with user avatar + name.

**Collapse behavior:**
- Toggle button in header collapses to 52px icon-only mode
- Collapse state persisted to `localStorage` via `SidebarProvider`
- Group labels and item labels fade out via CSS transition when collapsed
- Tooltip shows item label on hover when collapsed

**Mobile behavior:**
- Below `md` breakpoint, sidebar is hidden
- Hamburger button (`fa-bars`) shown in topbar
- Clicking opens shadcn `Sheet` from the left with full sidebar content

### Page Shell (`AppChrome`)

`apps/web/src/app/app-chrome.tsx` is updated to use `SidebarProvider` + `SidebarInset`:

```
SidebarProvider
  AppSidebar (nav-sidebar.tsx)
  SidebarInset
    Topbar (white, h-14, border-bottom)
      SidebarTrigger (hamburger on mobile, subtle toggle on desktop)
      Page title
      Action slot (right side)
    main (flex-1, overflow-y-auto, bg-slate-50, p-5)
      {children}
```

### Card Layout Pattern

All page content sections use shadcn `Card`:

```tsx
<Card>
  <CardHeader className="flex-row items-center justify-between py-3 px-4">
    <CardTitle className="text-sm font-semibold">Section title</CardTitle>
    <Badge variant="secondary">count</Badge>
  </CardHeader>
  <CardContent className="p-0">
    {/* list items or grid */}
  </CardContent>
</Card>
```

Stat/summary cards on the Today dashboard use a 4-column grid of Cards with a colored icon, label, value, and subtext.

### Badge Variants

| Variant | Use case | Colors |
|---|---|---|
| `default` | Primary accent | sky-600 bg, white text |
| `secondary` | Neutral counts | slate-100 bg, slate-600 text |
| `outline` | Status labels | white bg, slate-200 border |
| `destructive` | Errors/overdue | red-50 bg, red-700 text |

---

## Files Changed

| File | Change |
|---|---|
| `apps/web/src/app/globals.css` | CSS custom property tokens, import Font Awesome CDN |
| `apps/web/src/app/layout.tsx` | Wrap in `SidebarProvider` |
| `apps/web/src/app/app-chrome.tsx` | Use `SidebarInset`, topbar with `SidebarTrigger` |
| `apps/web/src/app/nav-sidebar.tsx` | Full rewrite using shadcn `Sidebar` components |
| `apps/web/src/components/ui/` | Add shadcn components (sidebar, card, badge, button, sheet, avatar, separator) |
| `apps/web/src/app/today/page.tsx` | Update to card layout pattern |
| `apps/web/package.json` | Add shadcn/ui, `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` |
| `apps/web/src/lib/utils.ts` | Add `cn()` helper |
| `docs/ui-standards.md` | New — UI standards reference |
| `CLAUDE.md` | Add UI Standards section |

---

## Standards Artifacts

Two standards documents are created as part of this work:

1. **`docs/ui-standards.md`** — full reference: color tokens, component usage rules, spacing, typography, icon conventions, do/don't examples.
2. **`CLAUDE.md` UI Standards section** — concise rules Claude reads every session: accent color, which shadcn components to use for which patterns, sidebar rules, card rules.

---

## Out of Scope

- Per-page redesigns beyond `today/page.tsx` (other pages get the new shell/sidebar automatically; their internal layouts are updated in a follow-up)
- Dark mode
- Animations beyond sidebar collapse transition
- New features or data changes
