# Multi-Tenant Property Website App (`apps/sites`) -- Phase 4

**Date:** 2026-03-23
**Status:** Draft
**Phase:** 4 (follows monorepo merge Phases 1-3)

---

## Problem

The WALT repository has 3 nearly identical property website apps (Palmera, Dreamscape, Frisco Waves & Fairways) that are copy-pasted with only content/data files changed. Phase 1-3 moved shared libraries and services into the host-ai monorepo. Phase 4 replaces those 3 apps with a single multi-tenant Next.js app.

## Goals

1. Create a single Next.js app (`apps/sites`) that serves multiple property websites from different domains
2. Drive branding (colors, logo, fonts) through database configuration -- no code changes to add a new site
3. Serve property data from `@walt/db` where available, with bundled JSON seed data as fallback
4. Match the existing WALT property site page set and functionality
5. Support ISR caching for performance (LCP under 2.5s)

## Non-Goals

- Portfolio template (Stay in Frisco multi-property aggregator) -- future work
- Multiple layout templates -- future work, single shared layout for now
- AI-powered content management -- future work (separate spec)
- Migrating all JSON content to database -- Phase 5 (separate spec)
- Self-service website builder UI in Hostpilot -- future work
- `/things-to-do` and `/directions` pages -- descoped to Phase 5 content migration

---

## Architecture

### App Structure

```
apps/sites/
  src/
    app/                        # Next.js App Router
      layout.tsx                # Root layout -- resolves site, injects theme CSS vars
      page.tsx                  # Home page
      gallery/page.tsx          # Photo gallery
      amenities/page.tsx        # Amenities list
      reviews/page.tsx          # Guest reviews
      faq/page.tsx              # FAQ
      house-rules/page.tsx      # House rules
      contact/page.tsx          # Contact/inquiry form
      about/page.tsx            # About the host/property
      book/page.tsx             # Booking flow
      policies/page.tsx         # Cancellation policy, terms
      blog/page.tsx             # Blog listing/index
      blog/[slug]/page.tsx      # Blog post detail
      events/page.tsx           # Local events
      not-found.tsx             # Branded 404 page (uses site theme)
      sitemap.ts                # Dynamic sitemap
      robots.ts                 # Robots.txt
    lib/
      site-context.ts           # Site config resolution + React context provider
      theme.ts                  # Maps site config -> CSS custom properties
      data.ts                   # Data access layer (DB with JSON fallback)
    components/                 # Shared UI components
      HeroSection.tsx           # Full-width hero image with overlay text + booking CTA
      PropertyStats.tsx         # Bedrooms/bathrooms/guests icons bar
      GalleryGrid.tsx           # Categorized photo grid with lightbox
      ReviewsCarousel.tsx       # Auto-rotating reviews with progress bar
      AmenitiesList.tsx         # Categorized amenities with icons
      BookingWidget.tsx         # Calendar + booking CTA (connects to bookings service)
      LeadForm.tsx              # Contact/inquiry form
      SiteHeader.tsx            # Navigation header (driven by site config)
      SiteFooter.tsx            # Footer with links
    data/                       # Bundled JSON seed data (fallback until Phase 5 DB migration)
      palmera/
        property.json
        amenities.json
        gallery.json
        reviews.json
      dreamscape/
        ...
      frisco-waves/
        ...
```

### Site Config Resolution

**Production flow:**

```
Request -> Next.js middleware (Edge Runtime) reads Host header
  -> Sets x-site-domain request header (middleware CANNOT query DB — Edge Runtime limitation)
  -> Root layout.tsx (Node.js Server Component) reads x-site-domain via headers()
  -> Calls resolveSite(domain) which queries `sites` table (LRU cached, 5-minute TTL)
  -> Injects site config into React context via SiteProvider
  -> All pages/components read from context
```

**Development flow:**

```
DEV_SITE_ID=palmera env var -> resolveSite() bypasses domain lookup, queries by slug instead
```

**Important:** The middleware only extracts the domain and forwards it as a header. All DB queries happen in `resolveSite()` which runs in Node.js Server Components, not the Edge Runtime.

---

## Database Tables

Two new tables in `@walt/db`:

### `sites` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `organizationId` | TEXT | FK to organizations |
| `slug` | TEXT UNIQUE | e.g., `palmera` |
| `domain` | TEXT UNIQUE | e.g., `palmera-frisco.com` |
| `templateType` | TEXT DEFAULT `property` | For future template selection |
| `name` | TEXT | Display name, e.g., `Palmera Frisco` |
| `tagline` | TEXT | |
| `description` | TEXT | |
| `logoUrl` | TEXT | |
| `faviconUrl` | TEXT | |
| `ogImageUrl` | TEXT | |
| `primaryColor` | TEXT | Hex, e.g., `#0284c7` |
| `secondaryColor` | TEXT | |
| `accentColor` | TEXT | |
| `fontHeading` | TEXT | Font family name, e.g., `Playfair Display` |
| `fontBody` | TEXT | e.g., `Inter` |
| `borderRadius` | TEXT | `sm` / `md` / `lg` |
| `createdAt` | TIMESTAMP | |
| `updatedAt` | TIMESTAMP | |

### `siteProperties` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `siteId` | UUID | FK to sites |
| `organizationId` | TEXT | |
| `propertyId` | TEXT | FK to properties (text to match existing PKs) |
| `featured` | BOOLEAN DEFAULT false | |
| `sortOrder` | INTEGER DEFAULT 0 | |
| `createdAt` | TIMESTAMP | |
| `updatedAt` | TIMESTAMP | |

### `sitePages` table

Per-site page configuration — controls which pages are enabled and provides custom SEO metadata.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `siteId` | UUID | FK to sites |
| `organizationId` | TEXT | Denormalized for query efficiency |
| `slug` | TEXT | e.g., `about`, `contact`, `blog` |
| `title` | TEXT | Page title |
| `seoTitle` | TEXT | Custom SEO title (optional) |
| `seoDescription` | TEXT | Custom SEO description (optional) |
| `enabled` | BOOLEAN DEFAULT true | Controls page visibility + navigation |
| `sortOrder` | INTEGER DEFAULT 0 | Navigation ordering |
| `createdAt` | TIMESTAMP | |
| `updatedAt` | TIMESTAMP | |

Navigation is derived from the template's page routes filtered by `sitePages.enabled`. Pages without a `sitePages` row default to enabled.

### Relationship with `siteConfigs` (Phase 3 booking tables)

The Phase 3 `siteConfigs` table uses `siteId: varchar(80)` as a free-form string identifier for booking configuration (Stripe keys, fee rates, etc.). The new `sites` table uses `slug: TEXT UNIQUE` as its human-readable identifier.

**Reconciliation:** `siteConfigs.siteId` should match `sites.slug`. For example, a site with `slug: 'palmera'` has a corresponding `siteConfigs` row with `siteId: 'palmera'`. No schema change is needed — the relationship is by convention on the slug value. A future migration can add a FK constraint if desired.

---

## Theming System

CSS custom properties injected by the root layout from the site config:

```tsx
// In layout.tsx
const site = await resolveSite();

<html style={{
  '--color-primary': site.primaryColor,
  '--color-secondary': site.secondaryColor,
  '--color-accent': site.accentColor,
  '--font-heading': site.fontHeading,
  '--font-body': site.fontBody,
}}>
  <body className="font-[var(--font-body)]">
    <SiteProvider site={site}>
      {children}
    </SiteProvider>
  </body>
</html>
```

All components use `var(--color-primary)` etc. instead of hardcoded colors.

**Font loading:** `next/font` requires static, build-time declarations. All fonts in the curated set are pre-loaded at build time:

```typescript
const fonts = {
  'Inter': Inter({ subsets: ['latin'], display: 'swap' }),
  'Playfair Display': Playfair_Display({ subsets: ['latin'], display: 'swap' }),
  'Lora': Lora({ subsets: ['latin'], display: 'swap' }),
  'Montserrat': Montserrat({ subsets: ['latin'], display: 'swap' }),
};
```

At runtime, the correct pre-loaded font class is selected based on the site config value and applied to the HTML element. The curated set keeps bundle size reasonable while covering common property site aesthetics.

**Border radius** is mapped to a `--radius` CSS custom property (`sm` = `0.25rem`, `md` = `0.5rem`, `lg` = `0.75rem`).

---

## Data Access Layer

`lib/data.ts` provides functions that try DB first, fall back to bundled JSON:

```typescript
export async function getPropertyData(siteSlug: string): Promise<PropertyData> {
  // Try DB (properties table via @walt/db)
  const dbProperty = await db.query.properties.findFirst({ ... });
  if (dbProperty) return normalizeFromDb(dbProperty);

  // Fall back to bundled JSON
  const jsonData = await import(`@/data/${siteSlug}/property.json`);
  return normalizeFromJson(jsonData);
}
```

Similar pattern for amenities, gallery, reviews, etc. All DB queries are scoped by `organizationId` (resolved from the site config) for consistency with existing access patterns.

This makes Phase 5 (DB migration) a data task, not a code change.

### Content Pipeline Integration

| Content Type | Source | Fallback |
|---|---|---|
| Property details | `properties` table (Hospitable sync) | `data/{slug}/property.json` |
| Gallery images | `propertyGuidebookEntries` with media | `data/{slug}/gallery.json` |
| Amenities | `propertyAppliances` + property data | `data/{slug}/amenities.json` |
| Reviews | `reviews` table | `data/{slug}/reviews.json` |
| FAQs | `propertyFaqs` + `knowledgeEntries` | None (DB only, already populated) |
| Blog posts | `seoDrafts` (status = published) | None (DB only) |
| Events | `seoEventCandidates` | None (DB only) |
| House rules | (not in DB yet) | `data/{slug}/house-rules.json` |
| About | (not in DB yet) | `data/{slug}/about.json` |

---

## Pages

| Page | Route | Description |
|---|---|---|
| Home | `/` | Hero gallery, property stats, amenity highlights, reviews carousel, booking CTA |
| Gallery | `/gallery` | Full photo gallery organized by room/category |
| Amenities | `/amenities` | Categorized amenity list with icons |
| Reviews | `/reviews` | Guest reviews from all platforms |
| FAQ | `/faq` | Property-specific FAQ |
| House Rules | `/house-rules` | Rules, check-in/checkout, policies |
| Contact | `/contact` | Contact/inquiry lead form |
| About | `/about` | About the host/property story |
| Book | `/book` | Booking flow (calendar to bookings service) |
| Policies | `/policies` | Cancellation policy, terms |
| Blog Index | `/blog` | Blog listing page |
| Blog Post | `/blog/[slug]` | Blog post detail from SEO pipeline |
| Events | `/events` | Local events from SEO pipeline |

---

## Caching Strategy

| Content | Strategy | TTL |
|---|---|---|
| Site config resolution | In-memory LRU cache | 5 minutes |
| Property pages (home, gallery, amenities) | ISR | `revalidate: 300` (5 min) |
| Static content pages (about, house-rules, policies) | ISR | `revalidate: 3600` (1 hour) |
| Blog/events | ISR | `revalidate: 600` (10 min) |
| Reviews | ISR | `revalidate: 600` (10 min) |
| Availability/calendar on `/book` | Fresh every request | No cache (booking accuracy) |

**ISR cache isolation per site:** Next.js ISR caches by path, not by domain. Since multiple sites share the same path structure (`/gallery`, `/amenities`, etc.), all pages must call `headers()` to read the site domain, which opts them out of static generation. Pages use server-side rendering with the LRU site config cache providing the performance benefit instead of ISR's static cache. This is the correct trade-off — the LRU cache (5-min TTL) plus Next.js server-side rendering is fast enough for the traffic profile, and avoids the complexity of per-site ISR cache keying.

---

## SEO

- `sitemap.ts` -- dynamically generates sitemap based on enabled pages for the resolved site
- `robots.ts` -- standard robots.txt, noindex on `/book`
- `generateMetadata()` on each page -- pulls title, description, og:image from site config
- Structured data (JSON-LD) for property schema on home page
- Canonical URLs set per domain

---

## Deployment

- New `Dockerfile.sites` -- builds `apps/sites` as a standalone Next.js app
- New container in `docker-compose.prod.yml` on port 3001
- Caddy routing: property domains to `sites:3001`
- `DEV_SITE_ID` env var for local development

**Caddy config addition:**

```
palmera-frisco.com, dreamscapefrisco.com, friscowavesandfairways.com {
  reverse_proxy sites:3001
}
```

---

## Seed Data

The existing WALT JSON data files need to be bundled in `apps/sites/src/data/` organized by site slug. This includes:

- `property.json` -- property metadata (bedrooms, bathrooms, sleeps, description)
- `amenities.json` -- amenity list with categories and icons
- `gallery.json` -- photo gallery metadata organized by room/category
- `reviews.json` -- guest reviews array

This data is read only as a fallback. As data gets migrated to the DB (Phase 5), the JSON files become unused.

---

## Migration Strategy

1. Add `sites` and `siteProperties` tables to `@walt/db`, generate migration
2. Create seed script to populate `sites`, `siteProperties`, and `sitePages` tables with Palmera, Dreamscape, Frisco W&F configs
3. Scaffold `apps/sites` with Next.js App Router, Tailwind, theming system
4. Implement site resolution middleware + SiteProvider context
5. Build components (extracted from WALT site patterns)
6. Build pages using components + data access layer
7. Bundle WALT JSON seed data
8. Add `Dockerfile.sites` and update docker-compose + Caddy
9. Verify all 3 sites render correctly
10. Deploy alongside WALT sites for parallel testing

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Font loading performance with dynamic fonts | Limit to curated font set, use `next/font` with `display: swap` |
| SEO disruption during cutover | Maintain exact URL structures, verify sitemaps match, parallel run before DNS switch |
| Missing data in DB fallback path | JSON seed data covers everything the current sites show |
| Theme CSS variables not covering all styling needs | Start with the 6 core variables (primary, secondary, accent, heading font, body font, border radius), extend as needed |
| Contact form submissions need a backend | LeadForm posts to an API route in `apps/sites` that sends email via `@walt/ses` and optionally subscribes to MailerLite via `@walt/mailerlite` |

---

## Success Criteria

1. All 3 property websites render correctly from `apps/sites` with content matching current WALT sites
2. Each site has distinct branding (colors, logo) driven purely by database config
3. Adding a 4th property site requires only a new `sites` row + seed data, no code changes
4. LCP under 2.5s on Lighthouse
5. Sitemaps and structured data match current WALT output
6. `pnpm turbo run typecheck lint build --filter=sites` passes
