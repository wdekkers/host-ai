# Pool Temperature Display — Design Spec

**Date:** 2026-03-19
**Status:** Ready for review

## Overview

Display live pool water temperatures on the `/today` dashboard for properties equipped with iAqualink. Temperatures are polled every 15 minutes by a server-side cron job and stored in the database. The last known temperature is always shown even when the pool pump is off, with a timestamp indicating how fresh the reading is.

Poolside Tech integration is deferred — no public or reverse-engineered API exists at this time.

## Scope

### In scope (Phase 1)

- TypeScript iAqualink API client (no Python dependency)
- 15-minute polling cron that stores readings in the database
- Pool temperature section on `/today` dashboard
- Per-property device serial configuration (stored on `properties` table)
- Graceful handling of pump-off state (null temperature, last known value shown)

### Out of scope

- Poolside Tech integration — deferred pending API research
- Pool temperature history / charts
- Alerts or suggestions triggered by temperature (e.g. "pool too cold before arrival")
- Temperature set point control

## Data Model

### Existing table: `properties` (addition)

Add one nullable column:

| Column | Type | Notes |
|---|---|---|
| `iaqualink_device_serial` | text | nullable — set once per property directly in DB; properties without this are skipped by the cron |

### New table: `pool_temperature_readings`

Stores one row per poll per property.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | generated via `.defaultRandom()` in Drizzle |
| `property_id` | text NOT NULL | soft reference to `properties.id` — no DB FK |
| `device_serial` | text NOT NULL | iAqualink device serial used for this reading |
| `temperature_f` | integer | nullable — null means pump was off at poll time; no valid reading available |
| `polled_at` | timestamptz NOT NULL | when this reading was taken |

**Index:** `(property_id, polled_at DESC)` — supports the dashboard query pattern (latest reading per property).

No unique constraint — one row per poll is intentional for future historical queries.

## iAqualink API Client

New file: `apps/web/src/lib/iaqualink.ts`

### Authentication

POST `https://prod.zodiac-io.com/users/v1/login`

```json
{
  "email": "<IAQUALINK_USERNAME>",
  "password": "<IAQUALINK_PASSWORD>",
  "apiKey": "EOOEMOW4YR6QNB07"
}
```

`EOOEMOW4YR6QNB07` is a fixed public API key shared by all iAqualink integrations — it is not a secret and can be hardcoded in source. It is present in all reverse-engineered implementations of this API.

Returns an auth token. Token is cached in-process (module-level variable) and reused across calls. On 401, clear the cached token, re-authenticate, and retry once.

**Token TTL:** The exact expiry duration is undocumented. The 401-retry approach handles expiry gracefully for now. If token expiry issues arise in production, add proactive re-auth (e.g., re-authenticate every 12 hours) as a follow-up.

Credentials stored as `IAQUALINK_USERNAME` and `IAQUALINK_PASSWORD` in `.env.production`.

### Reading Device Temperature

GET `https://prod.zodiac-io.com/devices/v2/{serial}/shadow`

Authorization header: `Bearer <token>`

Response contains a `reported` state object. The `pool_temp` key holds the current water temperature in °F. This key is absent (or null) when the pump is not running — treat missing/null as pump-off state.

**Note:** The exact path to `pool_temp` within the shadow response must be confirmed during implementation by logging the raw response. The reverse-engineered API has shown this field under `reported.state` or similar nested paths depending on device firmware version.

### Exported interface

```typescript
interface PoolReading {
  deviceSerial: string;
  temperatureF: number | null; // null = pump off
  polledAt: Date;
}

async function readTemperature(deviceSerial: string): Promise<PoolReading>
```

## Cron Endpoint

`POST /api/cron/poll-pool-temps`

Protected with `Authorization: Bearer <CRON_SECRET>` (same pattern as existing cron routes). `CRON_SECRET` already exists in `.env.production`.

**File structure** (mandatory per project rules — route files may only export HTTP method handlers):

```
apps/web/src/app/api/cron/poll-pool-temps/
  handler.ts      ← business logic: exported handlePollPoolTemps function
  route.ts        ← only: export const POST = handlePollPoolTemps
  handler.test.ts ← imports from handler.ts
```

Logic in `handler.ts`:
1. Query all properties where `iaqualink_device_serial IS NOT NULL`
2. For each property, call `readTemperature(property.iaqualinkDeviceSerial)`
3. Insert one row into `pool_temperature_readings` per property — `temperature_f` is null if pump was off
4. Log result (property name, temp or "pump off") for cron log visibility
5. On iAqualink API error for a single device: log and continue — don't fail the entire cron

**Ubuntu crontab addition:**
```
*/15 * * * * curl -s -X POST https://ai.walt-services.com/api/cron/poll-pool-temps -H "Authorization: Bearer $CRON_SECRET" >> /var/log/walt-cron.log 2>&1
```

## Dashboard: `/today`

### Data fetching

New server-side function `getPoolTemperatures(orgId)` in `apps/web/src/app/today/page.tsx`.

Uses two raw SQL queries via Drizzle's `db.execute(sql`...`)` — `DISTINCT ON` is a PostgreSQL extension not supported by Drizzle's query builder.

**Query 1 — latest poll per property (includes pump-off rows):**

```sql
SELECT DISTINCT ON (r.property_id)
  r.property_id,
  r.temperature_f,
  r.polled_at,
  p.name AS property_name
FROM pool_temperature_readings r
JOIN properties p ON p.id = r.property_id
WHERE EXISTS (
  SELECT 1 FROM property_access pa
  WHERE pa.property_id = r.property_id
    AND pa.organization_id = $orgId
)
  AND p.iaqualink_device_serial IS NOT NULL
ORDER BY r.property_id, r.polled_at DESC
```

**Query 2 — latest non-null temperature per property (for "last known" when pump is off):**

```sql
SELECT DISTINCT ON (r.property_id)
  r.property_id,
  r.temperature_f,
  r.polled_at
FROM pool_temperature_readings r
WHERE EXISTS (
  SELECT 1 FROM property_access pa
  WHERE pa.property_id = r.property_id
    AND pa.organization_id = $orgId
)
  AND r.temperature_f IS NOT NULL
ORDER BY r.property_id, r.polled_at DESC
```

Using `EXISTS` rather than a JOIN on `property_access` avoids duplicate rows (the `property_access` table has one row per user per property per org, so a direct JOIN multiplies results).

If the org has no pool properties with a device serial, both queries return empty and the section is omitted entirely.

### UI

A "Pool Temperatures" section rendered below the summary chips, above Turnovers. Only shown when the result set is non-empty.

Each property card displays:
- **Property name**
- **Temperature** — e.g. "82°F" (from latest non-null reading). "—" if no reading ever recorded.
- **"as of [time]"** — timestamp of the last non-null reading, in grey
- **"Pump off"** badge — shown when the most recent poll returned null temp

Cards are displayed in a horizontal scroll row on mobile, wrapping on desktop.

## Drizzle Migration

Two changes require a new migration:
1. Add `iaqualink_device_serial` nullable text column to `properties`
2. Create `pool_temperature_readings` table with the index above

## New Environment Variables

| Variable | Notes |
|---|---|
| `IAQUALINK_USERNAME` | iAqualink account email |
| `IAQUALINK_PASSWORD` | iAqualink account password |
| `CRON_SECRET` | Already exists in `.env.production` — used by all cron endpoints |

`IAQUALINK_USERNAME` and `IAQUALINK_PASSWORD` are new and must be added to `/opt/walt/.env.production` on the Lightsail server.

## Testing

- Unit: iAqualink client auth — mock fetch; assert token is cached and reused; assert re-auth on 401 (token cleared, login called again, retry succeeds)
- Unit: `readTemperature` — mock shadow response with `pool_temp` present → returns temperature; mock response with `pool_temp` absent → returns null
- Unit: cron handler — properties without `iaqualink_device_serial` are skipped; API error on one device does not stop others; one DB row inserted per property
- Unit: `getPoolTemperatures` — property with no readings returns no card; property with only null readings shows "—" with no "as of"; property with pump-off latest poll shows last known temp + "Pump off" badge
