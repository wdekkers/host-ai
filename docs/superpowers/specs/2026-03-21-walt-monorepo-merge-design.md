# WALT Monorepo Merge & Multi-Tenant Website Engine

## Problem

Two repositories (host-ai and WALT) share the same PostgreSQL database, same tech stack (Next.js, TypeScript, Fastify, Drizzle ORM, Tailwind, pnpm + Turbo), and same `@walt` namespace. This causes:

1. **Duplicate Hospitable API sync** — both repos independently pull property/reservation data from Hospitable, even though host-ai already stores it in the shared database
2. **Schema drift risk** — both repos define their own Drizzle schema against the same database
3. **Cross-repo coordination** — host-ai's SEO pipeline generates content (drafts, events, opportunities) that WALT websites will soon need to consume, requiring coordinated deploys
4. **Code duplication** — WALT has 3 nearly identical property website apps (Palmera, Dreamscape, Frisco Waves & Fairways) that are copy-pasted with only content/data files changed
5. **Developer friction** — sole developer maintaining two repos, two CI pipelines, two Docker Compose configs for tightly coupled systems

## Goals

1. Merge WALT's shared libraries and services into host-ai
2. Unify the database schema into a single `@walt/db` package
3. Replace 4 separate website apps with a single multi-tenant website app (`apps/sites`)
4. Support two template types: **property** (single property) and **portfolio** (multi-property aggregator)
5. Drive theming and content through database configuration (colors, logo, fonts, domain)
6. Eliminate duplicate Hospitable sync
7. Incorporate competitive improvements identified from Airbnb/VRBO analysis
8. Retire the WALT repository

## Non-Goals

- Building a PMS abstraction layer (future work — currently Hospitable only)
- Building a marketplace/global discovery site (future vision, not this spec)
- Self-service host onboarding or website builder UI in Hostpilot (future)
- Migrating WALT's Terraform infrastructure config (can remain separate or be addressed later)

## Architecture

### Monorepo Structure After Merge

```
host-ai/
├── apps/
│   ├── web/                        # Hostpilot command center (existing, unchanged)
│   ├── sites/                      # Multi-tenant property websites (NEW)
│   └── gateway/                    # API gateway (existing, unchanged)
├── services/
│   ├── identity/                   # (existing)
│   ├── messaging/                  # (existing)
│   ├── ops/                        # (existing)
│   ├── notifications/              # (existing)
│   ├── tasks/                      # (existing)
│   └── bookings/                   # Booking engine (FROM WALT service-bookings)
├── packages/
│   ├── db/                         # Unified Drizzle schema (merge WALT tables)
│   ├── contracts/                  # Shared Zod schemas (extend with booking/site contracts)
│   ├── api-client/                 # (existing)
│   ├── hospitable/                 # Hospitable API client (FROM WALT libraries/hospitable-api)
│   ├── stripe/                     # Stripe integration (FROM WALT libraries/stripe)
│   ├── ses/                        # AWS SES email (FROM WALT libraries/ses)
│   ├── cdn/                        # Image CDN utilities (FROM WALT libraries/cdn)
│   ├── config-eslint/              # (existing)
│   └── config-typescript/          # (existing)
└── infra/
    ├── docker/                     # Extended with sites + bookings Dockerfiles
    ├── docker-compose.yml
    └── docker-compose.prod.yml     # Extended with sites + bookings containers
```

### What Gets Absorbed vs. Dropped

| WALT Component | Destination | Notes |
|---|---|---|
| `libraries/hospitable-api` | `packages/hospitable` | Generated API client, reused by host-ai's sync |
| `libraries/stripe` | `packages/stripe` | Booking payments |
| `libraries/ses` | `packages/ses` | Email sending |
| `libraries/cdn` | `packages/cdn` | Image URL helpers, CloudFront integration |
| `libraries/twilio` | Dropped | host-ai's `services/messaging` already handles Twilio |
| `libraries/mailerlite` | `packages/mailerlite` | Newsletter integration for websites |
| `libraries/fontawesome` | Dropped | host-ai uses Lucide React per UI standards |
| `libraries/booking-client` | Merged into `packages/contracts` | Booking types become shared Zod contracts |
| `libraries/hospitable-webhooks` | Merged into `services/bookings` or existing webhook handling | Webhook handlers |
| `apps/web-stayinfrisco` | Template source for portfolio template | Code analyzed, best patterns extracted |
| `apps/web-palmera` | Template source for property template | Code analyzed, best patterns extracted |
| `apps/web-dreamscape` | Dropped (duplicate of palmera) | Content migrates to DB |
| `apps/web-friscowavesandfairways` | Dropped (duplicate of palmera) | Content migrates to DB |
| `apps/walt-services` | Dropped (superseded) | Evaluate for any unique functionality |
| `apps/walt-management` | Dropped (superseded by host-ai web) | Admin features already in Hostpilot |
| `apps/service-walt-management` | Absorbed into existing services | Hospitable sync consolidated, content endpoints distributed |
| `apps/service-bookings` | `services/bookings` | Booking processing + Stripe checkout |
| `infra/terraform` | Evaluate separately | RDS, CloudFront, Lambda@Edge may remain standalone |

### Multi-Tenant Website App (`apps/sites`)

This is the core new component. A single Next.js app that serves multiple property websites from different domains.

#### Domain Resolution

```
Request → Domain/Host header → Lookup site config → Resolve template + theme + properties
```

The app resolves which site to render based on the incoming domain:
- `palmera-frisco.com` → property template, Palmera config
- `dreamscapefrisco.com` → property template, Dreamscape config
- `stayinfrisco.com` → portfolio template, Stay in Frisco config

#### Site Configuration (Database-Driven)

New tables in `@walt/db`:

```
sites
  id              UUID PK
  organizationId  UUID FK → organizations
  slug            TEXT UNIQUE
  domain          TEXT UNIQUE          -- custom domain
  templateType    ENUM('property', 'portfolio')
  name            TEXT                 -- site display name
  tagline         TEXT
  description     TEXT
  logoUrl         TEXT
  faviconUrl      TEXT
  ogImageUrl      TEXT
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP

siteThemes
  id              UUID PK
  siteId          UUID FK → sites
  primaryColor    TEXT                 -- hex color (e.g. #0284c7)
  secondaryColor  TEXT
  accentColor     TEXT
  fontHeading     TEXT                 -- font family name
  fontBody        TEXT
  borderRadius    TEXT                 -- 'sm' | 'md' | 'lg'
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP

siteProperties
  id              UUID PK
  siteId          UUID FK → sites
  propertyId      UUID FK → properties
  featured        BOOLEAN DEFAULT false
  sortOrder       INTEGER DEFAULT 0
  createdAt       TIMESTAMP

sitePages
  id              UUID PK
  siteId          UUID FK → sites
  slug            TEXT                 -- e.g. 'about', 'contact', 'house-rules'
  title           TEXT
  content         JSONB               -- structured page content
  seoTitle        TEXT
  seoDescription  TEXT
  enabled         BOOLEAN DEFAULT true
  sortOrder       INTEGER DEFAULT 0
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP

siteNavItems
  id              UUID PK
  siteId          UUID FK → sites
  label           TEXT
  href            TEXT
  sortOrder       INTEGER DEFAULT 0
  enabled         BOOLEAN DEFAULT true
```

#### Template System

Two template types, each a set of Next.js page components that receive site config + theme as props/context:

**Property Template** (single property showcase):
- `/` — Hero gallery, property stats, amenity highlights, reviews carousel, booking CTA, "book direct & save" messaging
- `/gallery` — Full photo gallery organized by room/category
- `/amenities` — Categorized amenity list with detail pages for key amenities (pool, kitchen, spa)
- `/reviews` — Guest reviews aggregated from all platforms
- `/faq` — Property-specific FAQ
- `/house-rules` — Rules, check-in/checkout, policies
- `/contact` — Contact/inquiry form
- `/book` — Booking flow (calendar → guest details → Stripe checkout)
- `/about` — About the host/property story
- `/things-to-do` — Local area guide (from host-ai knowledge entries)
- `/events` — Local events (from host-ai SEO event candidates)
- `/blog/[slug]` — Blog posts (from host-ai SEO drafts when published)
- `/policies` — Cancellation policy, terms
- `/directions` — Getting there, parking, airport info

**Portfolio Template** (multi-property aggregator):
- `/` — Hero with search, featured properties grid, value proposition, events CTA
- `/properties` — Full property listing with filtering
- `/property/[slug]` — Individual property detail (reuses property template components)
- `/property/[slug]/faq` — Property-specific FAQ
- `/search` — Availability search across properties
- `/booking` — Booking flow
- `/about` — About the host/company
- `/contact` — Contact form with lead capture
- `/events/[hub]/[slug]` — Event landing pages (from SEO pipeline)
- `/things-to-do` — Area guides with categories (restaurants, kids, activities)
- `/nearby/[city]` — Nearby city guides
- `/blog/[slug]` — Blog posts
- `/faq` — General FAQ
- `/amenities` — Cross-property amenity highlights
- `/house-rules` — General house rules
- `/terms`, `/privacy`, `/cancellation-policy` — Legal pages

#### Theming System

CSS custom properties driven by the `siteThemes` table, injected via a root layout provider:

```tsx
// Simplified concept
<html style={{
  '--color-primary': theme.primaryColor,
  '--color-secondary': theme.secondaryColor,
  '--color-accent': theme.accentColor,
  '--font-heading': theme.fontHeading,
  '--font-body': theme.fontBody,
}}>
```

All template components use these CSS variables instead of hardcoded colors. This allows each site to have its own look without code changes.

Font loading handled via `next/font` with a dynamic font resolver based on site config.

#### Content Pipeline Integration

The websites consume content generated by host-ai's existing pipelines:

| Content Type | Source in host-ai | How sites consume it |
|---|---|---|
| Property details | `properties` table (synced from Hospitable) | Direct DB read |
| Reservations/availability | `reservations` table | Calendar availability queries |
| Reviews | `reviews` table | Displayed on property + reviews pages |
| Blog posts | `seoDrafts` table (when status = published) | Blog listing + detail pages |
| Events | `seoEventCandidates` table | Events calendar + landing pages |
| FAQs | `propertyFaqs` + `knowledgeEntries` tables | FAQ pages |
| Area guides | `knowledgeEntries` (property-scoped, topic = 'area-guide') | Things to do pages |
| Property photos | `propertyGuidebookEntries` with media | Gallery pages |

No duplicate data fetching — the sites app reads directly from the shared `@walt/db`.

### Competitive Improvements to Incorporate

Based on analysis of Airbnb, VRBO, and top direct-booking sites:

#### High Priority
1. **"Book Direct & Save" section** — Prominent messaging on property pages showing price advantage vs. OTAs. Simple banner/card component.
2. **Enhanced amenity showcases** — Dedicated sub-sections for key amenities (pool with dimensions/heating info, kitchen with appliance details, outdoor area). Leverage existing `propertyAppliances` table data.
3. **Sleep arrangements visual** — Bedroom cards showing bed type icons (king, queen, sofa bed) — standard on both Airbnb and VRBO, missing from current sites.
4. **Price breakdown transparency** — Show nightly rate × nights, cleaning fee, total. No hidden fees messaging.
5. **Weather/seasonal info** — Simple static or API-driven section: average temps by month, best time to visit, packing tips.

#### Medium Priority
6. **Directions / Getting Here page** — Airport info, driving directions, parking instructions. Data from `knowledgeEntries`.
7. **Guest testimonials with photos** — Beyond platform reviews: curated testimonials with guest photos from their stay.
8. **Newsletter with lead magnet** — "Download our free local guide" as email capture incentive.
9. **Host profile section** — Larger bio, photo, hosting philosophy, response time. Data from `organizations` table.

#### Future (Not This Spec)
10. Video/virtual tours — Requires content creation workflow
11. Guest portal — Post-booking digital house manual (could be a Hostpilot feature)
12. Return guest loyalty program — Requires user accounts
13. Gift certificates — Requires e-commerce flow

### Database Schema Changes

#### New Tables
- `sites` — Site configuration (domain, template type, name, branding)
- `siteThemes` — Per-site color/font theming
- `siteProperties` — Many-to-many linking sites to properties
- `sitePages` — Custom page content per site
- `siteNavItems` — Navigation configuration per site

#### Merged Tables (from WALT)
The following WALT tables need to be evaluated for merge into `@walt/db`:
- `booking_requests` — Booking workflow state (guest info, dates, Stripe intent). Merge as-is.
- `property_calendar_days` — Daily availability/pricing. Evaluate if `reservations` table already covers this or if per-day pricing granularity is needed.
- `blog_posts` — May overlap with `seoDrafts`. Evaluate whether `seoDrafts` with a "published" status can serve as the blog post table, or if a separate table is needed for editorially-created content.
- `events` — May overlap with `seoEventCandidates`. Same evaluation.
- `website_faqs` — Likely covered by existing `propertyFaqs` + `knowledgeEntries`.
- `website_guide_categories` / `website_guide_items` — Evaluate overlap with `propertyGuidebookEntries`.
- `ai_assistant_rules` — Evaluate overlap with `agentConfigs`.

#### Tables to Drop (WALT duplicates)
- WALT's `properties` — use host-ai's
- WALT's `reservations` — use host-ai's
- WALT's `reservation_messages` — use host-ai's `messages`

### Deployment

#### Docker Changes
- New `Dockerfile.sites` — builds `apps/sites` as a standalone Next.js app
- New service in `docker-compose.prod.yml`: `sites` container on an internal port
- Caddy routing: property domains → sites container, `ai.walt-services.com` → web container (unchanged)
- `services/bookings` added to the existing `Dockerfile.fastify` multi-service build

#### Domain Routing (Caddy)
```
# Property/portfolio sites — all custom domains route to the sites app
palmera-frisco.com, dreamscapefrisco.com, stayinfrisco.com, friscowavesandfairways.com {
  reverse_proxy sites:3001
}

# Hostpilot command center — unchanged
ai.walt-services.com {
  # existing routing unchanged
}
```

The `apps/sites` app reads the `Host` header to resolve which site config to load.

#### Lightsail
Current Lightsail instance may need to be upgraded (more RAM/CPU) to handle the additional containers. Alternatively, the sites app could run on its own Lightsail instance with a shared database connection.

### Migration Strategy

This should be executed in phases to minimize risk:

**Phase 1: Move packages** — Bring WALT libraries into host-ai as packages. No functional changes, just code relocation. Verify builds pass.

**Phase 2: Unify schema** — Merge WALT's tables into `@walt/db`. Create migration. Audit for conflicts with existing tables.

**Phase 3: Build bookings service** — Move `service-bookings` into host-ai `services/`. Wire up Stripe integration via `packages/stripe`.

**Phase 4: Build sites app** — Create `apps/sites` with domain resolution, theming system, and both templates. Start with the property template since it's simpler and has 3 existing sites to validate against.

**Phase 5: Migrate content** — Move WALT's static JSON data files (property.json, amenities.json, gallery.json, reviews) into the database. Create seed scripts.

**Phase 6: Competitive improvements** — Add book-direct messaging, enhanced amenity showcases, sleep arrangements, price breakdown, weather/seasonal info.

**Phase 7: Deploy & cut over** — Deploy the sites app alongside existing containers. Update DNS for property domains to point to the new sites app. Verify everything works. Retire WALT repo.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Schema merge conflicts | Medium | High | Audit both schemas side-by-side before merging. Run migration on a staging DB first. |
| SEO ranking disruption during cutover | Medium | High | Maintain exact URL structures. Set up 301 redirects for any changed paths. Verify sitemaps and structured data match. |
| Increased build times | Low | Low | Turbo caching means only changed packages rebuild. `apps/sites` builds independently of `apps/web`. |
| Lightsail resource constraints | Medium | Medium | Monitor resource usage. Plan to upgrade instance size or split into two instances if needed. |
| Font Awesome → Lucide icon migration | Low | Low | Map FA icons to Lucide equivalents. Per UI standards, Lucide is required. |

## Success Criteria

1. All 4 WALT websites render identically (or better) from the single `apps/sites` app
2. Zero duplicate Hospitable API calls — all property data comes from `@walt/db`
3. SEO pipeline content (blog posts, events) surfaces on the websites without cross-repo coordination
4. Adding a new property website requires only database configuration (new `sites` + `siteThemes` + `siteProperties` rows), no code changes
5. WALT repository is archived
6. CI pipeline passes: typecheck, lint, build for all apps and packages
