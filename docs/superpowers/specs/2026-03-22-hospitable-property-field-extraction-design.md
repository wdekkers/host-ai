# Hospitable Property Field Extraction

**Date:** 2026-03-22
**Status:** Draft
**Ticket:** #006 (partial — structured onboarding fields)

## Problem

The `properties` table stores only 5 meaningful fields (`id`, `name`, `address`, `city`, `status`) plus the full Hospitable API response in a `raw` JSONB blob. The AI cannot reliably access check-in times, pet policies, amenities, or capacity from JSONB — it falls back to manually-entered knowledge entries or invents policies.

Meanwhile, the Hospitable `/v2/properties` endpoint returns ~30 structured fields that are sitting unused inside `raw`.

## Goal

1. Extract **every field** from the Hospitable property API into named columns on the `properties` table.
2. Update the sync normalizer so these columns are populated automatically on every sync.
3. Wire the structured fields into the AI prompt assembly so the AI has authoritative property facts before falling back to knowledge entries.
4. Display the extracted fields on a read-only property detail UI.

## New Columns

All columns are **nullable** and added via a single additive migration. The existing `raw` column is preserved.

### Tier 1 — High AI Value

| Column | DB Type | Hospitable Source |
|---|---|---|
| `checkInTime` | `text` | `check_in` |
| `checkOutTime` | `text` | `check_out` |
| `timezone` | `text` | `timezone` |
| `maxGuests` | `integer` | `capacity.max` |
| `bedrooms` | `integer` | `capacity.bedrooms` |
| `beds` | `integer` | `capacity.beds` |
| `bathrooms` | `text` | `capacity.bathrooms` (text to preserve half-baths like "2.5") |
| `petsAllowed` | `boolean` | `house_rules.pets_allowed` |
| `smokingAllowed` | `boolean` | `house_rules.smoking_allowed` |
| `eventsAllowed` | `boolean` | `house_rules.events_allowed` |
| `amenities` | `text[]` | `amenities` |

### Tier 2 — Descriptive & Structural

| Column | DB Type | Hospitable Source |
|---|---|---|
| `description` | `text` | `description` |
| `summary` | `text` | `summary` |
| `propertyType` | `text` | `property_type` |
| `roomType` | `text` | `room_type` |
| `pictureUrl` | `text` | `picture` |
| `currency` | `text` | `currency` |
| `addressState` | `text` | `address.state` |
| `country` | `text` | `address.country` |
| `postcode` | `text` | `address.postcode` |
| `addressNumber` | `text` | `address.number` |
| `latitude` | `doublePrecision` | `address.coordinates.latitude` |
| `longitude` | `doublePrecision` | `address.coordinates.longitude` |
| `listings` | `jsonb` | `listings` — `$type<Array<{ platform: string; platform_id: string; platform_name?: string; platform_email?: string }>>()` |
| `roomDetails` | `jsonb` | `room_details` — `$type<Array<{ type: string; quantity: number }>>()` |
| `tags` | `text[]` | `tags` |
| `publicName` | `text` | `public_name` |
| `calendarRestricted` | `boolean` | `calendar_restricted` |
| `parentChild` | `jsonb` | `parent_child` — `$type<{ type: string; parent?: string; children?: string[]; siblings?: string[] }>()` |
| `icalImports` | `jsonb` | `ical_imports` — `$type<Array<{ uuid: string; url: string; name?: string }>>()` |

**Total: 30 new columns** (11 Tier 1 + 19 Tier 2).

**Note on existing `address` column:** The existing `address` column continues to hold the street/display address. The new `addressNumber` holds the house/unit number specifically. The new `addressState` holds the state/province.

## Sync & Normalization

### `normalizeProperty()` update

Expand `apps/web/src/lib/hospitable-normalize.ts` to extract all new fields from the raw payload. The function currently returns `{ id, name, address, city, status, raw }` and will return all 30 additional fields.

Extraction logic:
- Scalar fields: direct access (e.g., `raw.check_in`, `raw.timezone`)
- Nested objects: destructure (e.g., `raw.capacity.max`, `raw.house_rules.pets_allowed`, `raw.address.state`)
- Arrays: pass through (e.g., `raw.amenities`, `raw.tags`)
- JSONB fields: pass through as-is (e.g., `raw.listings`, `raw.room_details`, `raw.parent_child`, `raw.ical_imports`)

### Sync handler

No code changes needed to `sync-hospitable/handler.ts`. It already spreads the `normalizeProperty()` output into the upsert, so new fields flow through automatically. Note: the `PropertyInsert` type (via `InferInsertModel`) will expand to include the new columns, which may affect any tests that mock `normalizeProperty()` output.

### Cleanup

Update `apps/web/src/lib/seo-drafts/property-context.ts` — the `rawToSummary()` function currently digs into the `raw` blob to get `description`/`summary`. After this change, read the column directly instead.

## AI Consumption

### Priority order

1. **Structured columns** (authoritative — direct from the listing)
2. **Knowledge entries** (supplements — host-authored details like WiFi password, parking specifics, checkout steps)
3. **Property memory** (learned facts from conversations)

### Prompt assembly

Update `apps/web/src/lib/generate-reply-suggestion.ts` to fetch the full property row from the `properties` table using the `propertyId` it already receives. Build a "Property Facts" section from the new columns and insert it into the system prompt before knowledge entries. Existing manual columns (`hasPool`, `iaqualinkDeviceSerial`) should also be included in the property facts when non-null.

Example output:

```
## Property Facts (from listing)
- Check-in: 4:00 PM | Check-out: 11:00 AM
- Max guests: 12 | Bedrooms: 4 | Beds: 6 | Bathrooms: 3
- Pets: No | Smoking: No | Events: No
- Amenities: wifi, pool, hot tub, parking, kitchen, washer, dryer
- Property type: House
- Timezone: America/Chicago
```

Only non-null fields are included. The AI never invents a policy — if a field is null and no knowledge entry exists, it should say it doesn't have that information.

## Property Detail UI

Display extracted fields in a read-only "Listing Details" section on the property page, organized by:

- **Overview** — name, public name, property type, picture, description, summary
- **Capacity** — max guests, bedrooms, beds, bathrooms, room details
- **Timing** — check-in time, check-out time, timezone
- **House Rules** — pets, smoking, events (shown as badges)
- **Amenities** — rendered as tag/chip list
- **Location** — full address (number, street, city, state, country, postcode), map pin if coordinates exist
- **Platforms** — connected listings from the `listings` jsonb
- **Meta** — tags, calendar restricted, parent/child relationships, iCal imports

All fields are read-only (API-sourced). The existing `syncedAt` column provides the "Last synced" timestamp — no new column needed. Null fields are hidden (no empty rows).

## Files Changed

| File | Change |
|---|---|
| `packages/db/src/schema.ts` | Add 30 columns to `properties` table |
| `packages/db/drizzle/` | New migration file |
| `apps/web/src/lib/hospitable-normalize.ts` | Expand `normalizeProperty()` to extract all fields |
| `apps/web/src/lib/seo-drafts/property-context.ts` | Use columns instead of raw blob |
| `apps/web/src/lib/generate-reply-suggestion.ts` | Fetch property row, build "Property Facts" prompt section |
| Property detail UI page (e.g. `apps/web/src/app/(dashboard)/properties/[id]/page.tsx`) | New read-only listing details section |

## Out of Scope

- Manual edit forms for property fields (add later if API gaps found)
- `fieldSources` tracking (not needed while everything is API-sourced)
- Host-authored text fields beyond what Hospitable provides
- Changes to knowledge entries or property memory tables

## Backfill Strategy

After the migration adds the new nullable columns and the normalizer is updated, existing property rows will have `null` for all new columns. Trigger a one-time Hospitable sync (`POST /api/admin/sync-hospitable`) to populate existing rows. No SQL backfill needed — the sync upsert will fill everything from the API.
