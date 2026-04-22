# Slice 1 — AI Revenue Manager: PriceLabs foundation

> **Addendum 2026-04-22 (schema rewrite against real API):** The initial schemas and client paths in this design were guessed from incomplete PriceLabs docs and did not match what the production API actually returns. The `@walt/pricelabs` client has been rewritten against the probed live shapes:
> - `GET /v1/listings` returns `{ listings: [...] }` (not a bare array). Each listing carries `pms`, `min`/`base`/`max`, `push_enabled`, `isHidden`, `city_name`, `state`, `no_of_bedrooms`, etc.
> - There is no `/v1/listings/{id}/recommended_prices` endpoint. Per-date prices come from a batched `POST /v1/listing_prices` with body `{ listings: [{id, pms}, ...] }`, returning a bare array where each entry is either a success row (`{id, pms, data: [RateEntry[]]}`) or an error row (`{id, pms, error, error_status}`).
> - There is no `/v1/listings/{id}/settings` endpoint. `min`/`base`/`max` live on the top-level listing object; settings snapshots now store the full listing as their blob.
> - `isBooked` is derived from PriceLabs' per-date `booking_status` (empty string means available, any other value means booked), not from joining our `reservations` table.
> - `user_price === -1` is PriceLabs' sentinel for "no host override" and maps to `publishedPrice = null`. All prices are integer dollars at the API boundary and converted to cents at the sync boundary.
> - Per-listing errors like `LISTING_TOGGLE_OFF` are counted as partial failures in the sync run rather than short-circuiting the whole run.
> - Mappings handler now filters out non-`push_enabled` listings (they aren't syncing in PriceLabs) and reports a `hiddenCount` so the UI can explain the filter.

> **Addendum 2026-04-21:** Simplified to use `PRICELABS_API_KEY` env var instead of per-org encrypted DB credentials. Rationale: PriceLabs issues one account-level API key; every other integration in this repo follows the env-var pattern. When SaaS multi-tenancy arrives, all integrations will be lifted to per-org credentials together rather than PriceLabs being a one-off. The `pricelabsCredentials` table, encryption helper, credentials API route, and connect/disconnect UI described below have been removed. The admin UI now shows either a `not_configured` message or the mapping table directly.

**Status:** Design approved, pending spec review → implementation plan.
**Source:** Decomposition of `docs/ai-revenue-manager-plan.md` (26-section vision) into a shippable first slice.
**Predecessor plan:** n/a — first slice of a multi-slice effort.
**Successor slices (out of scope here):**
- Slice 2: rules engine (overpricing, gap-night, min-stay friction, pace)
- Slice 3: AI reasoning layer + daily alerts
- Slice 4: monthly strategy memos
- Slice 5: PriceLabs settings write-back

---

## 1. Summary

Build the **data foundation** for the AI Revenue Manager:

- a reusable, typed client for the PriceLabs Customer API
- daily snapshots of PriceLabs recommendations and settings into our own database
- a multi-tenant mapping layer linking internal properties to PriceLabs listings
- a small admin UI to connect an account and confirm mappings
- a forward-looking pricing chart on the property details page

No rules engine. No AI. No alerts. No write-back. This slice makes the data available; later slices reason over it.

## 2. Why first

Every downstream feature in `docs/ai-revenue-manager-plan.md` — overpricing detection, gap-night risk, seasonal memos, write-back — depends on daily pricing snapshots and a working mapping between internal properties and PriceLabs listings. None of that exists today. Shipping this slice unblocks the rest; shipping anything else first would either invent fake data or require this slice to be built underneath it retroactively.

## 3. Scope

### Ships
- `packages/pricelabs/` — new typed HTTP client
- 5 new DB tables (credentials, listing mapping, pricing snapshots, settings snapshots, sync runs audit)
- Daily Vercel cron: `/api/cron/pricelabs-sync`
- Manual admin trigger: `/api/admin/pricelabs-sync` (for testing without waiting for 03:00 UTC)
- Admin UI: `/settings/integrations/pricelabs` — connect + confirm mappings
- Property page chart: 90-day forward recommended vs. published price with booked-date overlay
- Tests (package, cron handler, mapping API, credentials API), verification script

### Does NOT ship
- Rules engine or any overpriced/gap/pace detection logic
- AI summarization or alert generation
- Notifications (Slack, email, in-app) — `packages/notifications` stays untouched this slice
- Write-back to PriceLabs settings — `@walt/pricelabs` exposes read-only methods only
- Historical "ghost line" in the chart (deferred — see `tickets/open/026-revenue-manager-pricing-chart-enhancements.md`)
- Min-stay / constraint overlay row on the chart (deferred — same ticket)
- Interactive date-range selector, export, or cross-property comparison on the chart
- Monthly memos or portfolio-wide views

### Non-goals / explicitly not trying to solve
- Replacing PriceLabs as the pricing engine. PriceLabs remains the recommender; we archive and display.
- Solving the "Hospitable MCP vs. direct SDK" question. The existing `packages/hospitable/` direct SDK is used via already-synced `reservations` data. No MCP client this slice.
- Idempotency of daily sync runs. Re-running the same day simply writes a new `syncRunId` — duplicates are expected and harmless; consumers read the most recent run.

## 4. Architecture overview

```text
                    ┌─────────────────────┐
Vercel cron ────►   │  /api/cron/         │
(03:00 UTC daily)   │   pricelabs-sync    │
                    └─────────┬───────────┘
                              │
                              ▼
                    ┌─────────────────────┐       ┌──────────────────┐
                    │  runPriceLabsSync() │──────►│ @walt/pricelabs  │
                    │  (handler.ts)       │       │ (typed client)   │
                    └─────────┬───────────┘       └────────┬─────────┘
                              │                            │
                              │                            ▼
                              │                   PriceLabs Customer API
                              │
                              ▼
           ┌──────────────────────────────────────────┐
           │  Postgres                                │
           │  - pricelabsCredentials (per org)        │
           │  - pricelabsListings (mapping)           │
           │  - pricingSnapshots (time-series)        │
           │  - pricelabsSettingsSnapshots (blob)     │
           │  - pricelabsSyncRuns (audit log)         │
           └─────────────┬────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
 /settings/integrations/          /properties/[id]/details
   pricelabs                        (new chart card)
 (connect + map UI)                 (Recharts, 90d forward)
```

## 5. Package: `@walt/pricelabs`

New package in `packages/pricelabs/`, mirrors the shape of `packages/hospitable/`.

### Exports
```ts
export function createPriceLabsClient(opts: { apiKey: string; baseUrl?: string }): PriceLabsClient;

interface PriceLabsClient {
  listListings(): Promise<Listing[]>;
  getRecommendedRates(listingId: string, startDate: string, endDate: string): Promise<DailyRate[]>;
  getSettings(listingId: string): Promise<ListingSettings>;
}
```

### Rules
- Zod schemas for every response, types exported via `z.infer`
- Caller passes `apiKey` at construction — the package must never read env directly, so the cron can load the decrypted per-org key and inject it
- Read-only this slice — no `updateSettings` method exposed
- Its own env config (Zod-validated): optional `PRICELABS_BASE_URL` only
- Third-party deps: `zod` only. Uses global `fetch`.
- `baseUrl` defaults to the official PriceLabs Customer API host

### Retries
Simple 3-retry exponential backoff on 429 and 5xx. No request queue, no persistent work tracker — call volume is trivial (single-digit requests per org per day).

### Errors
Thrown errors carry a discriminated `code`: `'auth_rejected' | 'not_found' | 'rate_limited' | 'server_error' | 'network_error' | 'parse_error'`. The cron handler and credentials-validation endpoint both switch on this.

### Testing
- Unit tests per endpoint with fixture JSON responses (sanitized real responses committed under `packages/pricelabs/test/fixtures/`)
- Zod parse asserts on every fixture
- Retry test: mocked fetch returns 429 twice then 200
- Empty-key rejection: constructor throws on empty/whitespace `apiKey`

## 6. Database schema

Five new tables in `packages/db/src/schema.ts`, all `orgId`-scoped.

### 6.1 `pricelabsCredentials`
One row per org that has connected PriceLabs.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `orgId` | text fk → `organizations.id` | unique — one credential per org |
| `encryptedApiKey` | text | AES-256-GCM, key from new env var `PRICELABS_ENCRYPTION_KEY` |
| `apiKeyFingerprint` | text | last 4 chars of plaintext, shown in UI so user can confirm which key is stored |
| `status` | enum: `'active' \| 'invalid'` | updated to `invalid` when validation against `listListings` returns 401 |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

Unique: `(orgId)`.

Type convention: `orgId` is `text` to match the existing `organizations.id text primary key` column. `propertyId` is `text` to match `properties.id text primary key` (Hospitable-supplied). Only PK ids on new tables are `uuid`.

### 6.2 `pricelabsListings`
Mapping table: internal property ↔ PriceLabs listing.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `orgId` | text fk | |
| `propertyId` | text fk → `properties.id` | nullable (unmapped listings still get a row) |
| `pricelabsListingId` | text | PriceLabs' own listing id |
| `pricelabsListingName` | text | snapshot of PriceLabs name at mapping time |
| `status` | enum: `'active' \| 'unmapped' \| 'inactive'` | `active` = syncs; `unmapped` = no internal property picked; `inactive` = explicitly disabled by user |
| `matchConfidence` | enum: `'manual' \| 'auto-high' \| 'auto-low'` nullable | how the current mapping was established |
| `lastSyncedAt` | timestamp nullable | |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

Unique: `(orgId, pricelabsListingId)`.

### 6.3 `pricingSnapshots`
Time-series. One row per listing × date × sync run.

| Column | Type |
|---|---|
| `id` | uuid pk |
| `orgId` | text fk |
| `pricelabsListingId` | text |
| `date` | date — date the price applies to |
| `recommendedPrice` | integer (cents) |
| `publishedPrice` | integer (cents) nullable |
| `basePrice` / `minPrice` / `maxPrice` | integer (cents) |
| `minStay` | integer nullable |
| `closedToArrival` | boolean |
| `closedToDeparture` | boolean |
| `isBooked` | boolean — computed at write time by joining reservations |
| `syncRunId` | uuid fk → `pricelabsSyncRuns.id` |
| `createdAt` | timestamp |

Indexes: `(orgId, pricelabsListingId, date DESC)`, `(syncRunId)`.

Retention: keep forever. 4 listings × 365 days × ~365 runs/year = ~533K rows/year. Trivial.

### 6.4 `pricelabsSettingsSnapshots`
One row per listing × sync run. Full settings blob for future diffing.

| Column | Type |
|---|---|
| `id` | uuid pk |
| `orgId` | text fk |
| `pricelabsListingId` | text |
| `syncRunId` | uuid |
| `settingsBlob` | jsonb |
| `createdAt` | timestamp |

### 6.5 `pricelabsSyncRuns`
Audit log for every cron execution.

| Column | Type |
|---|---|
| `id` | uuid pk |
| `orgId` | text fk |
| `startedAt` | timestamp |
| `completedAt` | timestamp nullable |
| `status` | enum: `'running' \| 'success' \| 'partial' \| 'failed'` |
| `listingsSynced` | integer |
| `listingsFailed` | integer |
| `errorSummary` | text nullable — short, no stack traces |

### Encryption

New env var `PRICELABS_ENCRYPTION_KEY` (32 bytes, base64) read by the credentials API route and the cron handler. AES-256-GCM via Node `crypto`. Encryption and decryption happen only at those two boundaries; the plaintext key never leaves the process that needs it.

### Pricing data convention
All money fields use **integer cents** to match the existing `reservations.nightlyRate` convention.

## 7. Cron: `/api/cron/pricelabs-sync`

Runs daily at **03:00 UTC**. Authorized via `CRON_SECRET` bearer header (existing pattern). Handler lives in `apps/web/src/app/api/cron/pricelabs-sync/handler.ts` per the `route.ts`-only rule.

### Flow
```text
for each org with pricelabsCredentials.status = 'active':
  1. Decrypt API key
  2. Instantiate @walt/pricelabs client
  3. Insert pricelabsSyncRuns row (status='running')
  4. For each pricelabsListings where status='active':
       a. getRecommendedRates(listingId, today, today + 365 days)
       b. getSettings(listingId)
       c. Compute isBooked per date by querying reservations overlapping
          (propertyId = mapping.propertyId AND check-in <= date < check-out)
       d. Insert rows: pricingSnapshots (365) + pricelabsSettingsSnapshots (1)
       e. Update mapping.lastSyncedAt
       f. On per-listing error: log + increment listingsFailed + continue
  5. Update pricelabsSyncRuns (status = success | partial | failed, counts)
```

### Error handling
- Per-listing failures don't abort the org — the run continues; failures are counted into `listingsFailed`.
- Per-org failures don't abort other orgs — each org runs in its own try/catch.
- 429 from PriceLabs → `@walt/pricelabs` retries with backoff; if still failing, the listing is counted failed for that run.
- A credentials-rejected error (`auth_rejected`) sets `pricelabsCredentials.status = 'invalid'` and records it in `errorSummary`. The admin UI surfaces this on next visit.

### Manual trigger
`POST /api/admin/pricelabs-sync` calls the same handler, but authorized via user session + admin role (not `CRON_SECRET`). For ad-hoc testing.

### Volume
4 listings × 2 API calls/listing = 8 PriceLabs requests per cron run. 4 × 365 = 1,460 `pricingSnapshots` inserts + 4 `pricelabsSettingsSnapshots` inserts per day. Sub-second DB write, total runtime well under Vercel cron limits.

## 8. Admin UI: `/settings/integrations/pricelabs`

One new page with three states driven by `pricelabsCredentials`.

### State A — Not connected
Single-step form: "Paste your PriceLabs Customer API key." Help link to `help.pricelabs.co/portal/en/kb/articles/pricelabs-api`. On submit:
1. Validate the key by calling `@walt/pricelabs.listListings()` through a server route
2. On 200: encrypt + store in `pricelabsCredentials`, capture fingerprint, run auto-match, move to State C
3. On `auth_rejected`: stay in State A with inline error

### State B — Connected, key invalid
Identical to State A but shows `"Last key (•••4f2a) was rejected by PriceLabs — replace it."` Triggered when a cron run encountered `auth_rejected`.

### State C — Connected, mapping view
Table: one row per PriceLabs listing returned by the API.

| PriceLabs listing | Internal property | Status | Action |
|---|---|---|---|
| Dreamscape Retreat (Fairplay, TX) | ✓ Dreamscape (matched) | Active | [edit ▾] |
| Waves & Fairways – Frisco | ✓ Frisco Waves & Fairways (matched) | Active | [edit ▾] |
| Palmera Luxury | ⚠ No match — pick one | Unmapped | [pick ▾] |
| _Test Listing_ | – | Inactive | [activate] |

Warnings panel at top: "N unmapped listings — these won't be synced."

### Auto-match logic
Levenshtein distance on normalized names (lowercased, punctuation stripped, city/state suffixes stripped).
- Distance ≤ 3 → `auto-high` (green match badge)
- Distance 4–8 → `auto-low` (yellow, user must confirm)
- Distance > 8 → unmapped

Recomputed fresh each time the page loads — the auto-match result is never cached in the DB. Only user-confirmed mappings persist.

### Save behavior
Dirty-state aware button. Saves all edited rows at once. Any edited row gets `matchConfidence = 'manual'` regardless of whether the final choice matches the auto-suggestion.

### Permissions
Only `owner` and `manager` roles per `apps/web/src/lib/auth/permissions.ts`.

### Hooks (mobile-ready)
- `useListPriceLabsMappings()` — `GET /api/integrations/pricelabs/mappings`
- `useSavePriceLabsMappings()` — `POST /api/integrations/pricelabs/mappings`
- `useConnectPriceLabs()` — `POST /api/integrations/pricelabs/credentials`
- `useDisconnectPriceLabs()` — `DELETE /api/integrations/pricelabs/credentials` (nice-to-have, can skip if tight)

All hooks live in `apps/web/src/hooks/` for future React Native reuse. All routes support `Authorization: Bearer` in addition to session cookies.

### Styling
shadcn `Card`, `Table`, `Select`, `Button`, `Badge`, `Input`. Sky-600 accent. Lucide icons only.

## 9. Property page chart

### Where
New `Card` on `apps/web/src/app/properties/[id]/details/page.tsx`, below existing details cards. Renders only when the property has an active `pricelabsListings` row.

### What
90-day forward window. Card titled "Pricing — next 90 days", containing:
- Solid line (sky-600): recommended price
- Solid line (slate-700): published price (gaps where null)
- Background bands (slate-100): dates where `isBooked = true`
- Y-axis: nightly price formatted from cents to `$xxx`
- X-axis: daily ticks, weekly labels (`Apr 20`, `Apr 27`, …)
- Tooltip on hover: date, recommended, published, booked y/n, Δ% when both prices present
- Sub-caption: "Last synced {lastSyncedAt, relative}"

### Library
**Recharts** (BSD-3, React-native, composes with shadcn). Added to `apps/web/package.json`. Components: `LineChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `ReferenceArea`, `ResponsiveContainer`.

### API
`GET /api/properties/[id]/pricing-snapshots?days=90`

Response:
```json
{
  "listingId": "pl-abc123",
  "lastSyncedAt": "2026-04-20T03:00:12Z",
  "days": [
    { "date": "2026-04-20", "recommendedPrice": 52400, "publishedPrice": 55000, "isBooked": true },
    { "date": "2026-04-21", "recommendedPrice": 49500, "publishedPrice": 55000, "isBooked": false }
  ]
}
```

Query fetches only the most recent `syncRunId` for the listing — no historical runs.

### Auth
Org-scoped — user must have access to the property. Supports session cookies and `Authorization: Bearer`.

### States
| State | UI |
|---|---|
| Property has active mapping, cron has run | Chart renders |
| Property has active mapping, cron hasn't run yet | "Waiting for first PriceLabs sync — next run at 03:00 UTC" |
| Property has mapping but last sync failed | "Last sync failed at HH:MM — chart shows data from DD Mon" + stale data |
| Property has no mapping / org has no integration | Card doesn't render (absent, not empty) |
| API error | "Couldn't load pricing. [Retry]" |

### Hook
`usePricingSnapshots(propertyId, days)` in `apps/web/src/hooks/use-pricing-snapshots.ts`. Returns `{ data, isLoading, error, refetch }`.

### Component
`apps/web/src/components/pricing/pricing-chart.tsx` — pure presentation, takes `{ days, lastSyncedAt }`. No data fetching. Reusable in a future `/today` dashboard card.

## 10. Testing

### `packages/pricelabs/`
- Fixture-based unit tests per endpoint (sanitized real responses)
- Zod parse asserts
- Retry logic: mock fetch, 429 ×2 then 200
- Constructor rejects empty/whitespace `apiKey`

### Cron handler (`apps/web/src/app/api/cron/pricelabs-sync/handler.test.ts`)
- Happy path: 1 org, 2 mapped listings → 2 × 365 `pricingSnapshots`, 2 `pricelabsSettingsSnapshots`, 1 `pricelabsSyncRuns` with `status='success'`
- Per-listing failure: listing A OK, listing B 500 → run completes, B counted as failed, A lands
- Per-org failure: org A credentials `auth_rejected` → A's credentials status flipped to `invalid`, org B still succeeds
- `isBooked` accuracy: one reservation overlapping 3 of 365 days → exactly those 3 rows flagged
- No idempotency: re-running the cron same day writes another set of rows with a new `syncRunId` — not treated as a bug

### Mapping API (`/api/integrations/pricelabs/mappings`)
- Auth: unauthenticated → 401; user without `owner`/`manager` → 403
- Cross-org guard: user in org A cannot read/write org B's mappings
- Auto-match: 4 fixture listings × 4 internal properties with known similarity → each row gets expected `matchConfidence`

### Credentials API (`/api/integrations/pricelabs/credentials`)
- Invalid key (PriceLabs returns 401) → 400 response, nothing persisted
- Encryption round-trip: write → re-read → decrypt → matches plaintext

### Manual verification checklist (before calling Slice 1 done)
1. `curl` the admin endpoint → sync run completes without errors
2. `SELECT COUNT(*) FROM pricing_snapshots WHERE created_at > now() - interval '1 hour'` → non-zero for each active mapping
3. Load a mapped property's details page → chart renders with both lines, booked overlay visible where a reservation exists
4. Set a listing `status='inactive'` → next sync skips it → no new rows for that listing
5. Replace API key with a bad one → mapping page shows "Invalid key" state; next cron run writes `status='failed'` with a sane `errorSummary`

## 11. Observability

- `pricelabsSyncRuns` IS the primary log — queryable history, no separate telemetry system added
- Cron handler emits console logs: `[pricelabs-sync] org=X started` and `[pricelabs-sync] org=X done listings=N failed=M duration=Xms`
- On `listingsFailed > 0`, the run writes failing listing IDs + error class (not stack traces) to `errorSummary`
- No Slack / PagerDuty integration this slice — `packages/notifications` stays untouched; wiring alerts is Slice 3

## 12. Error surfaces

| Failure | User sees |
|---|---|
| Credentials rejected | Integrations page: "Last key was rejected — replace it" |
| Cron hasn't run yet | Property page card: "Waiting for first PriceLabs sync — next run at 03:00 UTC" |
| Last sync failed (credentials were fine, per-listing error) | Property page card: "Last sync failed at HH:MM — showing data from DD Mon" + stale chart |
| Property has no mapping | Property page: no pricing card rendered (absent, not empty) |
| Org has no integration at all | Property page: no pricing card rendered |

## 13. Open questions / follow-ups

None that block implementation. Items deferred intentionally (for visibility):

- **Historical "ghost line" on chart** — deferred per `tickets/open/026`; becomes useful after ≥2 weeks of snapshots
- **Min-stay / constraint overlay row** — same ticket
- **Alerting on failed sync runs** — happens in Slice 3 when AI + notifications wire in
- **Write-back to PriceLabs settings** — Slice 5, requires approval queue UI first

## 14. References

- Source plan: `docs/ai-revenue-manager-plan.md`
- Deferred-items ticket: `tickets/open/026-revenue-manager-pricing-chart-enhancements.md`
- AI provider pluggability memory: `.claude/projects/.../memory/feedback_ai_provider_pluggability.md`
- PriceLabs Customer API docs: https://help.pricelabs.co/portal/en/kb/articles/pricelabs-api
- PriceLabs API Postman collection: https://documenter.getpostman.com/view/507656/SVSEurQC
- Existing integration package shape: `packages/hospitable/`
- Existing cron pattern: `apps/web/src/app/api/cron/*`
- Existing schema + conventions: `packages/db/src/schema.ts`
