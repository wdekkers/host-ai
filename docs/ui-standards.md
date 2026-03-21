# UI Standards

This document defines the UI standards for the Walt web app. All new UI work must follow these conventions. The goal is a consistent, maintainable interface built on the established component library and design tokens.

**Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui v4 (`@base-ui/react` primitives), Lucide React.

---

## 1. Color Tokens

Colors are defined as CSS custom properties in `apps/web/src/app/globals.css` using the `@theme inline` block (Tailwind v4 syntax). Always use these tokens via Tailwind utility classes — never hardcode hex or oklch values in component JSX.

### Core tokens (light mode)

| Token | Value | Hex equivalent | Usage |
|---|---|---|---|
| `--primary` | `oklch(0.549 0.165 237.5)` | `#0284c7` (sky-600) | Primary actions, active states, accent |
| `--primary-foreground` | `oklch(1 0 0)` | white | Text on primary backgrounds |
| `--background` | `oklch(1 0 0)` | white | Page background |
| `--foreground` | `oklch(0.145 0 0)` | near-black | Default body text |
| `--card` | `oklch(1 0 0)` | white | Card surfaces |
| `--card-foreground` | `oklch(0.145 0 0)` | near-black | Text on cards |
| `--muted` | `oklch(0.97 0 0)` | gray-50 | Muted backgrounds |
| `--muted-foreground` | `oklch(0.556 0 0)` | gray-500 | Secondary/helper text |
| `--border` | `oklch(0.922 0 0)` | gray-200 | Default borders |
| `--destructive` | `oklch(0.577 0.245 27.325)` | red-600 | Errors, destructive actions |
| `--ring` | `oklch(0.549 0.165 237.5)` | sky-600 | Focus rings |

### Sidebar tokens

| Token | Value | Description |
|---|---|---|
| `--sidebar` | `oklch(1 0 0)` | Sidebar background (white) |
| `--sidebar-foreground` | `oklch(0.141 0.005 285.823)` | Sidebar text (slate-900) |
| `--sidebar-primary` | `oklch(0.549 0.165 237.5)` | Active nav item background (sky-600) |
| `--sidebar-primary-foreground` | `oklch(1 0 0)` | Active nav item text (white) |
| `--sidebar-accent` | `oklch(0.97 0.013 236.62)` | Hover/inactive highlight (sky-50) |
| `--sidebar-accent-foreground` | `oklch(0.549 0.165 237.5)` | Hover/inactive text (sky-600) |
| `--sidebar-border` | `oklch(0.928 0.006 264.531)` | Sidebar border (slate-200) |
| `--sidebar-ring` | `oklch(0.549 0.165 237.5)` | Focus ring in sidebar (sky-600) |

### How to use tokens in Tailwind

The `@theme inline` block maps each `--token` to a `--color-token` Tailwind CSS variable. Use standard utility class syntax:

```tsx
// Background
<div className="bg-primary">...</div>
<div className="bg-sidebar">...</div>
<div className="bg-muted">...</div>

// Text
<span className="text-primary">...</span>
<span className="text-muted-foreground">...</span>

// Border
<div className="border border-border">...</div>
<div className="border-l border-sidebar-border">...</div>
```

### Rules

- **Primary accent is sky-600.** Use `text-primary`, `bg-primary`, `border-primary`.
- **Never use green or teal as an accent color.** Green may appear in contextual status indicators (e.g., check-in icons) but must not be used as the brand or primary interactive color.
- Prefer token-based classes over raw Tailwind color utilities (e.g., prefer `bg-primary` over `bg-sky-600`).
- Dark mode is handled automatically via `.dark` class overrides in `globals.css` — no manual dark: variants needed for token-based colors.

---

## 2. Typography

### Font

The app uses **Geist** loaded via the `--font-geist` CSS variable, aliased to `--font-sans` in the `@theme inline` block. The `font-sans` class is applied globally to `html` in `globals.css`.

```css
/* globals.css */
--font-heading: var(--font-sans);
--font-sans: var(--font-geist);
```

Do not import or apply alternate fonts. All text inherits `font-sans` (Geist) by default.

### Text scale

Use Tailwind's text scale consistently:

| Use case | Classes |
|---|---|
| Page heading | `text-xl font-bold text-slate-900` |
| Section/card title | `text-sm font-semibold` (inside `CardTitle`) |
| Sub-heading | `text-base font-semibold text-slate-900` |
| Body / list items | `text-sm text-slate-900` |
| Secondary/helper text | `text-sm text-slate-500` |
| Small labels / metadata | `text-xs text-slate-400` |
| Stat numbers | `text-2xl font-bold text-slate-900` |
| Uppercase labels | `text-xs font-medium uppercase tracking-wide text-slate-400` |

### Example

```tsx
<div>
  <h1 className="text-xl font-bold text-slate-900">Today</h1>
  <p className="text-sm text-slate-500">Friday, March 20</p>
</div>
```

---

## 3. Sidebar

### Component

Use the shadcn `Sidebar` component from `@/components/ui/sidebar`. Do not implement a custom sidebar from scratch.

The sidebar is configured with `collapsible="icon"` mode, which collapses to icon-only width while preserving navigation affordance.

### Navigation routes

All nav routes are defined in `apps/web/src/lib/nav-links.ts` as `navGroups: NavGroup[]`. This is the single source of truth for navigation.

```ts
// apps/web/src/lib/nav-links.ts
export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Today',  href: '/today',  icon: Home },
      { label: 'Inbox',  href: '/inbox',  icon: Inbox },
      { label: 'Tasks',  href: '/tasks',  icon: CheckSquare },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Reservations', href: '/reservations',       icon: CalendarDays },
      { label: 'Properties',   href: '/properties',         icon: Building2 },
      { label: 'Checklists',   href: '/property-checklists',icon: ClipboardList },
      { label: 'Contacts',     href: '/contacts',           icon: BookUser },
    ],
  },
  {
    label: 'Content',
    items: [
      { label: 'SEO Drafts', href: '/seo-drafts', icon: Search },
      { label: 'Questions',  href: '/questions',  icon: HelpCircle },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', href: '/settings/agent', icon: Settings },
      { label: 'Admin',    href: '/admin/vendors',  icon: Wrench },
    ],
  },
];
```

### Rules

- Do not re-implement navigation manually (e.g., do not hardcode `<a>` or `<Link>` lists for nav).
- To add a new route, add it to `navGroups` in `nav-links.ts`. The sidebar renders from that array.
- Import type: `import type { NavItem, NavGroup } from '@/lib/nav-links'`.

---

## 4. Cards

Use shadcn `Card`, `CardHeader`, `CardTitle`, and `CardContent` from `@/components/ui/card` for all content containers.

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
```

### Common patterns

**Simple stat card:**
```tsx
<Card>
  <CardContent className="p-4">
    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
      <CalendarCheck className="h-4 w-4 text-sky-600" />
    </div>
    <div className="text-2xl font-bold text-slate-900">{count}</div>
    <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Label</div>
  </CardContent>
</Card>
```

**Card with header and count badge:**
```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
      <CheckSquare className="h-4 w-4 text-slate-400" />
      Tasks Due Today
    </CardTitle>
    <Badge variant="secondary">{tasks.length}</Badge>
  </CardHeader>
  <CardContent className="p-0">
    {/* content */}
  </CardContent>
</Card>
```

### Rules

- Do not use raw `<div>` with manual `border`, `rounded`, and `bg-white` classes as a substitute for `<Card>`. Use the `Card` component.
- `CardContent` padding is `p-4` or `p-5` for standard content. Use `p-0` when the content manages its own padding (e.g., divide-y lists).
- `CardHeader` uses `px-4 py-3` for compact headers with an icon + title row.

---

## 5. Badges

Use shadcn `Badge` from `@/components/ui/badge` for status labels, counts, priority indicators, and any small inline tag.

```tsx
import { Badge } from '@/components/ui/badge';
```

### Variants

| Variant | Use case |
|---|---|
| `default` | Primary/active state (sky-600 background) |
| `secondary` | Neutral counts, informational labels |
| `outline` | Subtle tag, deselected state |
| `destructive` | Error, high-priority, danger |

### Examples

```tsx
// Count in card header
<Badge variant="secondary">{turnovers.length}</Badge>

// Status label on a list row
<Badge variant={t.arrivalDate ? 'default' : 'outline'}>
  {t.arrivalDate ? 'Check-in' : 'Check-out'}
</Badge>

// Priority indicator
<Badge variant="destructive" className="ml-auto text-xs">High</Badge>

// Informational state
<Badge variant="secondary" className="mt-2 text-xs">Pump off</Badge>
```

### Rules

- Use `Badge` for all inline status/label chips. Do not build custom pill `<span>` elements with manual padding and border-radius.
- Size with `className="text-xs"` for compact contexts inside cards or list rows.

---

## 6. Buttons

Use shadcn `Button` from `@/components/ui/button`.

```tsx
import { Button } from '@/components/ui/button';
```

### Variants

| Variant | Description |
|---|---|
| `default` | Filled sky-600 button — primary CTA |
| `outline` | Bordered button — secondary action |
| `ghost` | No border/background — low-emphasis action, often used in toolbars |
| `destructive` | Red fill — irreversible or dangerous action |

### Examples

```tsx
// Primary action
<Button>Save Changes</Button>

// Secondary / cancel
<Button variant="outline">Cancel</Button>

// Icon button in a toolbar
<Button variant="ghost" size="icon">
  <Settings className="h-4 w-4" />
</Button>

// Danger action
<Button variant="destructive">Delete Property</Button>
```

### Rules

- Do not use `<button>` elements styled manually with Tailwind. Always use `<Button>`.
- Use `size="icon"` for icon-only buttons.
- The `render` prop pattern (from `@base-ui/react`) is used instead of `asChild` in this version of shadcn. Use `render` to compose with other elements if needed.

---

## 7. Icons

Use **Lucide React** for all icons. Lucide ships with shadcn/ui — no separate installation required.

```tsx
import { CalendarCheck, CheckSquare, Thermometer } from 'lucide-react';
```

### Standard size

The default icon size is `h-4 w-4`. Use this in nav items, card headers, button labels, and inline text.

```tsx
<CalendarCheck className="h-4 w-4 text-slate-400" />
```

Larger icons (e.g., `h-5 w-5` or `h-6 w-6`) may be used for empty-state illustrations or prominent feature icons.

### Color

- In card header titles: `text-slate-400`
- Inline with primary content: `text-primary` or `text-sky-600`
- Inside colored icon badges (e.g., `bg-sky-50`): match the icon color to the background hue (`text-sky-600`, `text-amber-600`, etc.)

### Rules

- **All icons must come from `lucide-react`.** Do not add Font Awesome, Heroicons, or any other icon library.
- Always size icons explicitly with height and width classes. Do not rely on default `em`-based sizing.
- Use semantic icon choices — pick icons that clearly represent the action or content.

---

## 8. Spacing

Use the Tailwind spacing scale throughout. Be consistent — pick from established patterns rather than inventing new values per component.

### Common patterns

| Context | Classes |
|---|---|
| Content area padding (cards) | `p-4` or `p-5` |
| Compact card header | `px-4 py-3` |
| List row | `px-4 py-3` |
| Grid gap (stat cards) | `gap-3` (compact) or `gap-4` (standard) |
| Vertical stack of sections | `space-y-4` or `space-y-5` |
| Inline icon + label gap | `gap-2` |
| Inline flex row items | `gap-3` |
| Small icon badge size | `h-8 w-8` with `rounded-lg` |

### Page layout

Page content areas use `space-y-5` as the outer vertical rhythm:

```tsx
<div className="space-y-5">
  {/* heading */}
  {/* stat cards grid */}
  {/* content cards */}
</div>
```

Stat card grids use responsive columns:

```tsx
<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
  {/* cards */}
</div>
```

---

## 9. Do / Don't Examples

### Cards

**Do** — use shadcn `Card` components:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

<Card>
  <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
      <CheckSquare className="h-4 w-4 text-slate-400" />
      Tasks
    </CardTitle>
    <Badge variant="secondary">{count}</Badge>
  </CardHeader>
  <CardContent className="p-0">
    {/* list content */}
  </CardContent>
</Card>
```

**Don't** — use a raw div to simulate a card:

```tsx
// DO NOT do this
<div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
  <h2 className="font-semibold">Tasks</h2>
  {/* content */}
</div>
```

---

### Icons

**Do** — import from `lucide-react` with explicit sizing:

```tsx
import { CalendarCheck } from 'lucide-react';

<CalendarCheck className="h-4 w-4 text-slate-400" />
```

**Don't** — use Font Awesome or unsized icons:

```tsx
// DO NOT do this
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
<FontAwesomeIcon icon="calendar" />

// DO NOT do this either (no explicit size)
<CalendarCheck />
```

---

### Sidebar

**Do** — add routes to `nav-links.ts` and let the sidebar component render them:

```ts
// apps/web/src/lib/nav-links.ts
{ label: 'Reports', href: '/reports', icon: BarChart2 },
```

**Don't** — hardcode navigation links directly in a layout or component:

```tsx
// DO NOT do this
<nav>
  <Link href="/today">Today</Link>
  <Link href="/inbox">Inbox</Link>
  <Link href="/tasks">Tasks</Link>
</nav>
```

---

### Badges vs custom spans

**Do** — use `<Badge>` for status chips:

```tsx
<Badge variant="destructive" className="text-xs">High</Badge>
```

**Don't** — build manual pill spans:

```tsx
// DO NOT do this
<span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
  High
</span>
```

---

### Primary color

**Do** — use the `primary` token:

```tsx
<Button>Save</Button>
<span className="text-primary">View details</span>
```

**Don't** — use green or teal as an accent, or hardcode sky-600:

```tsx
// DO NOT use green/teal as primary accent
<Button className="bg-teal-600">Save</Button>

// DO NOT hardcode; use token
<span className="text-sky-600">View details</span>
```
