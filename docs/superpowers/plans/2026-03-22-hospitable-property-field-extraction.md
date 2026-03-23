# Hospitable Property Field Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract all Hospitable API property fields into named columns, wire them into the AI prompt, and display them on a property detail page.

**Architecture:** Add 30 nullable columns to the `properties` table via an additive migration. Expand `normalizeProperty()` to extract all fields from the raw API payload. Build a `formatPropertyFacts()` helper for the AI prompt. Add a read-only "Listing Details" tab to the property settings page.

**Tech Stack:** Drizzle ORM, PostgreSQL, Next.js (App Router), React, Tailwind CSS, node:test

**Spec:** `docs/superpowers/specs/2026-03-22-hospitable-property-field-extraction-design.md`

---

## File Structure

| File | Role |
|---|---|
| `packages/db/src/schema.ts` | Add 30 columns to `properties` table |
| `packages/db/drizzle/0024_property_details.sql` | Migration SQL |
| `apps/web/src/lib/hospitable-normalize.ts` | Extract all fields in `normalizeProperty()` |
| `apps/web/src/lib/hospitable-normalize.test.ts` | Tests for expanded normalizer |
| `apps/web/src/lib/property-facts.ts` | `formatPropertyFacts()` — builds AI prompt section from property row |
| `apps/web/src/lib/property-facts.test.ts` | Tests for property facts formatter |
| `apps/web/src/lib/generate-reply-suggestion.ts` | Fetch property row, inject property facts into prompt |
| `apps/web/src/lib/seo-drafts/property-context.ts` | Cleanup: use columns instead of raw blob |
| `apps/web/src/app/properties/[id]/details/page.tsx` | New "Details" tab — read-only listing details |
| `apps/web/src/app/properties/[id]/PropertySettingsTabs.tsx` | Add "Details" tab link |

---

### Task 1: Schema — Add columns to `properties` table

**Files:**
- Modify: `packages/db/src/schema.ts:64-75`
- Create: `packages/db/drizzle/0024_property_details.sql`

- [ ] **Step 1: Add columns to schema.ts**

Add after the `iaqualinkDeviceSerial` column in the `properties` table definition:

```typescript
  // --- Hospitable extracted fields ---
  checkInTime: text('check_in_time'),
  checkOutTime: text('check_out_time'),
  timezone: text('timezone'),
  maxGuests: integer('max_guests'),
  bedrooms: integer('bedrooms'),
  beds: integer('beds'),
  bathrooms: text('bathrooms'), // text to preserve half-baths like "2.5"
  petsAllowed: boolean('pets_allowed'),
  smokingAllowed: boolean('smoking_allowed'),
  eventsAllowed: boolean('events_allowed'),
  amenities: text('amenities').array(),
  description: text('description'),
  summary: text('summary'),
  propertyType: text('property_type'),
  roomType: text('room_type'),
  pictureUrl: text('picture_url'),
  currency: text('currency'),
  addressState: text('address_state'),
  country: text('country'),
  postcode: text('postcode'),
  addressNumber: text('address_number'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  listings: jsonb('listings').$type<Array<{ platform: string; platform_id: string; platform_name?: string; platform_email?: string }>>(),
  roomDetails: jsonb('room_details').$type<Array<{ type: string; quantity: number }>>(),
  tags: text('tags').array(),
  publicName: text('public_name'),
  calendarRestricted: boolean('calendar_restricted'),
  parentChild: jsonb('parent_child').$type<{ type: string; parent?: string; children?: string[]; siblings?: string[] }>(),
  icalImports: jsonb('ical_imports').$type<Array<{ uuid: string; url: string; name?: string }>>(),
```

Add `doublePrecision` to the import from `drizzle-orm/pg-core`.

- [ ] **Step 2: Generate the migration**

Run:
```bash
cd packages/db && pnpm db:generate
```

Expected: A new migration file is created in `packages/db/drizzle/`. Rename it to `0024_property_details.sql` if needed.

- [ ] **Step 3: Run the migration**

Run:
```bash
cd packages/db && pnpm db:migrate
```

Expected: Migration applies successfully, 30 new nullable columns added to `walt.properties`.

- [ ] **Step 4: Verify typecheck passes**

Run:
```bash
pnpm turbo run typecheck --filter=@walt/db
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/
git commit -m "feat(db): add 30 Hospitable property detail columns to properties table"
```

---

### Task 2: Normalizer — Expand `normalizeProperty()` to extract all fields

**Files:**
- Modify: `apps/web/src/lib/hospitable-normalize.ts:72-82`
- Modify: `apps/web/src/lib/hospitable-normalize.test.ts`

- [ ] **Step 1: Write tests for expanded normalizer**

Add to `apps/web/src/lib/hospitable-normalize.test.ts`. Import `normalizeProperty` (add it to the existing import):

```typescript
void test('normalizeProperty extracts all Hospitable fields', () => {
  const raw = {
    id: 'prop-1',
    name: 'Beach House',
    public_name: 'Sunny Beach House',
    listed: true,
    check_in: '4:00 PM',
    check_out: '11:00 AM',
    timezone: 'America/Chicago',
    description: 'A beautiful beachfront property.',
    summary: 'Beachfront with pool.',
    property_type: 'house',
    room_type: 'entire_home',
    picture: 'https://example.com/pic.jpg',
    currency: 'USD',
    calendar_restricted: false,
    amenities: ['wifi', 'pool', 'parking', 'kitchen'],
    tags: ['luxury', 'beachfront'],
    capacity: { max: 12, bedrooms: 4, beds: 6, bathrooms: 3.5 },
    house_rules: { pets_allowed: false, smoking_allowed: false, events_allowed: true },
    address: {
      number: '123',
      street: '456 Ocean Dr',
      city: 'Frisco',
      state: 'TX',
      country: 'US',
      postcode: '75034',
      display: '456 Ocean Dr, Frisco, TX',
      coordinates: { latitude: 33.1507, longitude: -96.8236 },
    },
    listings: [
      { platform: 'airbnb', platform_id: 'AIR123', platform_name: 'Beach House on Airbnb' },
    ],
    room_details: [
      { type: 'king', quantity: 2 },
      { type: 'queen', quantity: 1 },
    ],
    parent_child: { type: 'parent', children: ['prop-2'] },
    ical_imports: [{ uuid: 'ical-1', url: 'https://example.com/cal.ics', name: 'VRBO' }],
  };

  const result = normalizeProperty(raw);

  // Existing fields
  assert.equal(result.id, 'prop-1');
  assert.equal(result.name, 'Beach House');
  assert.equal(result.address, '456 Ocean Dr');
  assert.equal(result.city, 'Frisco');
  assert.equal(result.status, 'active');

  // Tier 1
  assert.equal(result.checkInTime, '4:00 PM');
  assert.equal(result.checkOutTime, '11:00 AM');
  assert.equal(result.timezone, 'America/Chicago');
  assert.equal(result.maxGuests, 12);
  assert.equal(result.bedrooms, 4);
  assert.equal(result.beds, 6);
  assert.equal(result.bathrooms, '3.5');
  assert.equal(result.petsAllowed, false);
  assert.equal(result.smokingAllowed, false);
  assert.equal(result.eventsAllowed, true);
  assert.deepEqual(result.amenities, ['wifi', 'pool', 'parking', 'kitchen']);

  // Tier 2
  assert.equal(result.description, 'A beautiful beachfront property.');
  assert.equal(result.summary, 'Beachfront with pool.');
  assert.equal(result.propertyType, 'house');
  assert.equal(result.roomType, 'entire_home');
  assert.equal(result.pictureUrl, 'https://example.com/pic.jpg');
  assert.equal(result.currency, 'USD');
  assert.equal(result.addressState, 'TX');
  assert.equal(result.country, 'US');
  assert.equal(result.postcode, '75034');
  assert.equal(result.addressNumber, '123');
  assert.equal(result.latitude, 33.1507);
  assert.equal(result.longitude, -96.8236);
  assert.equal(result.publicName, 'Sunny Beach House');
  assert.equal(result.calendarRestricted, false);
  assert.deepEqual(result.listings, [
    { platform: 'airbnb', platform_id: 'AIR123', platform_name: 'Beach House on Airbnb' },
  ]);
  assert.deepEqual(result.roomDetails, [
    { type: 'king', quantity: 2 },
    { type: 'queen', quantity: 1 },
  ]);
  assert.deepEqual(result.tags, ['luxury', 'beachfront']);
  assert.deepEqual(result.parentChild, { type: 'parent', children: ['prop-2'] });
  assert.deepEqual(result.icalImports, [
    { uuid: 'ical-1', url: 'https://example.com/cal.ics', name: 'VRBO' },
  ]);
});

void test('normalizeProperty handles minimal payload gracefully', () => {
  const raw = { id: 'prop-min', name: 'Minimal', listed: false };
  const result = normalizeProperty(raw);
  assert.equal(result.id, 'prop-min');
  assert.equal(result.name, 'Minimal');
  assert.equal(result.status, 'inactive');
  assert.equal(result.checkInTime, null);
  assert.equal(result.maxGuests, null);
  assert.equal(result.petsAllowed, null);
  assert.equal(result.amenities, null);
  assert.equal(result.latitude, null);
  assert.equal(result.listings, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd apps/web && npx tsx --test src/lib/hospitable-normalize.test.ts
```

Expected: FAIL — new fields are not returned by `normalizeProperty()` yet.

- [ ] **Step 3: Expand `normalizeProperty()` implementation**

Replace the `normalizeProperty` function in `apps/web/src/lib/hospitable-normalize.ts`:

```typescript
export function normalizeProperty(raw: Record<string, unknown>): Omit<PropertyInsert, 'syncedAt'> {
  const addr = (raw.address ?? {}) as Record<string, unknown>;
  const capacity = (raw.capacity ?? {}) as Record<string, unknown>;
  const houseRules = (raw.house_rules ?? {}) as Record<string, unknown>;
  const coordinates = (addr.coordinates ?? {}) as Record<string, unknown>;

  return {
    id: String(raw.id),
    name: String(raw.name ?? raw.public_name ?? ''),
    address: str(addr.street ?? addr.display) ?? null,
    city: str(addr.city) ?? null,
    status: raw.listed === false ? 'inactive' : 'active',
    raw,

    // Tier 1 — High AI value
    checkInTime: str(raw.check_in),
    checkOutTime: str(raw.check_out),
    timezone: str(raw.timezone),
    maxGuests: num(capacity.max) != null ? Math.round(num(capacity.max)!) : null,
    bedrooms: num(capacity.bedrooms) != null ? Math.round(num(capacity.bedrooms)!) : null,
    beds: num(capacity.beds) != null ? Math.round(num(capacity.beds)!) : null,
    bathrooms: capacity.bathrooms != null ? String(capacity.bathrooms) : null,
    petsAllowed: typeof houseRules.pets_allowed === 'boolean' ? houseRules.pets_allowed : null,
    smokingAllowed: typeof houseRules.smoking_allowed === 'boolean' ? houseRules.smoking_allowed : null,
    eventsAllowed: typeof houseRules.events_allowed === 'boolean' ? houseRules.events_allowed : null,
    amenities: Array.isArray(raw.amenities) ? (raw.amenities as string[]) : null,

    // Tier 2 — Descriptive & structural
    description: str(raw.description),
    summary: str(raw.summary),
    propertyType: str(raw.property_type),
    roomType: str(raw.room_type),
    pictureUrl: str(raw.picture),
    currency: str(raw.currency),
    addressState: str(addr.state),
    country: str(addr.country),
    postcode: str(addr.postcode),
    addressNumber: str(addr.number),
    latitude: typeof coordinates.latitude === 'number' ? coordinates.latitude : null,
    longitude: typeof coordinates.longitude === 'number' ? coordinates.longitude : null,
    listings: Array.isArray(raw.listings)
      ? (raw.listings as Array<{ platform: string; platform_id: string; platform_name?: string; platform_email?: string }>)
      : null,
    roomDetails: Array.isArray(raw.room_details)
      ? (raw.room_details as Array<{ type: string; quantity: number }>)
      : null,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : null,
    publicName: str(raw.public_name),
    calendarRestricted: typeof raw.calendar_restricted === 'boolean' ? raw.calendar_restricted : null,
    parentChild: raw.parent_child && typeof raw.parent_child === 'object'
      ? (raw.parent_child as { type: string; parent?: string; children?: string[]; siblings?: string[] })
      : null,
    icalImports: Array.isArray(raw.ical_imports)
      ? (raw.ical_imports as Array<{ uuid: string; url: string; name?: string }>)
      : null,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd apps/web && npx tsx --test src/lib/hospitable-normalize.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Run typecheck**

Run:
```bash
pnpm turbo run typecheck --filter=@walt/web
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/hospitable-normalize.ts apps/web/src/lib/hospitable-normalize.test.ts
git commit -m "feat: expand normalizeProperty() to extract all Hospitable fields"
```

---

### Task 3: Property Facts — AI prompt helper

**Files:**
- Create: `apps/web/src/lib/property-facts.ts`
- Create: `apps/web/src/lib/property-facts.test.ts`
- Modify: `apps/web/src/lib/generate-reply-suggestion.ts`

- [ ] **Step 1: Write tests for `formatPropertyFacts()`**

Create `apps/web/src/lib/property-facts.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPropertyFacts } from './property-facts.js';

void test('formatPropertyFacts builds prompt section from full property row', () => {
  const result = formatPropertyFacts({
    checkInTime: '4:00 PM',
    checkOutTime: '11:00 AM',
    timezone: 'America/Chicago',
    maxGuests: 12,
    bedrooms: 4,
    beds: 6,
    bathrooms: '3.5',
    petsAllowed: false,
    smokingAllowed: false,
    eventsAllowed: true,
    amenities: ['wifi', 'pool', 'parking'],
    propertyType: 'house',
    hasPool: true,
    description: 'A beautiful beachfront property with ocean views.',
  });

  assert.ok(result.includes('Check-in: 4:00 PM'));
  assert.ok(result.includes('Check-out: 11:00 AM'));
  assert.ok(result.includes('Max guests: 12'));
  assert.ok(result.includes('Bedrooms: 4'));
  assert.ok(result.includes('Bathrooms: 3.5'));
  assert.ok(result.includes('Pets allowed: No'));
  assert.ok(result.includes('Events allowed: Yes'));
  assert.ok(result.includes('wifi, pool, parking'));
  assert.ok(result.includes('Property type: house'));
  assert.ok(result.includes('Pool: Yes'));
  assert.ok(result.includes('beachfront property'));
});

void test('formatPropertyFacts omits null fields', () => {
  const result = formatPropertyFacts({
    checkInTime: '3:00 PM',
    checkOutTime: null,
    timezone: null,
    maxGuests: null,
    bedrooms: null,
    beds: null,
    bathrooms: null,
    petsAllowed: null,
    smokingAllowed: null,
    eventsAllowed: null,
    amenities: null,
    propertyType: null,
    hasPool: false,
    description: null,
  });

  assert.ok(result.includes('Check-in: 3:00 PM'));
  assert.ok(!result.includes('Check-out'));
  assert.ok(!result.includes('Max guests'));
  assert.ok(!result.includes('Bedrooms'));
  assert.ok(!result.includes('Pets'));
});

void test('formatPropertyFacts returns empty string when no fields present', () => {
  const result = formatPropertyFacts({
    checkInTime: null,
    checkOutTime: null,
    timezone: null,
    maxGuests: null,
    bedrooms: null,
    beds: null,
    bathrooms: null,
    petsAllowed: null,
    smokingAllowed: null,
    eventsAllowed: null,
    amenities: null,
    propertyType: null,
    hasPool: false,
    description: null,
  });

  assert.equal(result, '');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd apps/web && npx tsx --test src/lib/property-facts.test.ts
```

Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement `formatPropertyFacts()`**

Create `apps/web/src/lib/property-facts.ts`:

```typescript
export type PropertyFactsInput = {
  checkInTime: string | null;
  checkOutTime: string | null;
  timezone: string | null;
  maxGuests: number | null;
  bedrooms: number | null;
  beds: number | null;
  bathrooms: string | null;
  petsAllowed: boolean | null;
  smokingAllowed: boolean | null;
  eventsAllowed: boolean | null;
  amenities: string[] | null;
  propertyType: string | null;
  hasPool: boolean;
  description: string | null;
};

function yn(val: boolean | null): string | null {
  if (val === null) return null;
  return val ? 'Yes' : 'No';
}

export function formatPropertyFacts(input: PropertyFactsInput): string {
  const lines: string[] = [];

  if (input.checkInTime) lines.push(`Check-in: ${input.checkInTime}`);
  if (input.checkOutTime) lines.push(`Check-out: ${input.checkOutTime}`);
  if (input.timezone) lines.push(`Timezone: ${input.timezone}`);
  if (input.maxGuests != null) lines.push(`Max guests: ${input.maxGuests}`);
  if (input.bedrooms != null) lines.push(`Bedrooms: ${input.bedrooms}`);
  if (input.beds != null) lines.push(`Beds: ${input.beds}`);
  if (input.bathrooms != null) lines.push(`Bathrooms: ${input.bathrooms}`);
  if (input.propertyType) lines.push(`Property type: ${input.propertyType}`);

  const petsLine = yn(input.petsAllowed);
  if (petsLine) lines.push(`Pets allowed: ${petsLine}`);
  const smokingLine = yn(input.smokingAllowed);
  if (smokingLine) lines.push(`Smoking allowed: ${smokingLine}`);
  const eventsLine = yn(input.eventsAllowed);
  if (eventsLine) lines.push(`Events allowed: ${eventsLine}`);

  if (input.hasPool) lines.push(`Pool: Yes`);

  if (input.amenities && input.amenities.length > 0) {
    lines.push(`Amenities: ${input.amenities.join(', ')}`);
  }

  if (input.description) lines.push(`Description: ${input.description}`);

  if (lines.length === 0) return '';
  return `Property facts (from listing):\n${lines.map((l) => `- ${l}`).join('\n')}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd apps/web && npx tsx --test src/lib/property-facts.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/property-facts.ts apps/web/src/lib/property-facts.test.ts
git commit -m "feat: add formatPropertyFacts() helper for AI prompt assembly"
```

---

### Task 4: Wire property facts into AI prompt

**Files:**
- Modify: `apps/web/src/lib/generate-reply-suggestion.ts`

- [ ] **Step 1: Add property facts fetch and injection**

At the top of `generate-reply-suggestion.ts`, add imports:

```typescript
import { properties } from '@walt/db';
import { formatPropertyFacts } from './property-facts';
```

Inside `generateReplySuggestion()`, after the memory context block (after line ~131), add a property facts fetch:

```typescript
  // --- Property Facts: structured fields from listing ---
  let propertyFactsContext = '';
  if (propertyId) {
    const [propRow] = await db
      .select({
        checkInTime: properties.checkInTime,
        checkOutTime: properties.checkOutTime,
        timezone: properties.timezone,
        maxGuests: properties.maxGuests,
        bedrooms: properties.bedrooms,
        beds: properties.beds,
        bathrooms: properties.bathrooms,
        petsAllowed: properties.petsAllowed,
        smokingAllowed: properties.smokingAllowed,
        eventsAllowed: properties.eventsAllowed,
        amenities: properties.amenities,
        propertyType: properties.propertyType,
        hasPool: properties.hasPool,
        description: properties.description,
      })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (propRow) {
      propertyFactsContext = formatPropertyFacts(propRow);
      if (propertyFactsContext) {
        sourcesUsed.push({
          type: 'property_field',
          id: propertyId,
          label: 'Listing details',
          snippet: propertyFactsContext.slice(0, 120),
        });
      }
    }
  }
```

Then in the `systemPrompt` template, insert `propertyFactsContext` before the knowledge context. Change the end of the system prompt from:

```typescript
Reply in the same language as the guest message. Do not start with "Of course" or "Certainly".${knowledgeContext ? `\n\n${knowledgeContext}` : ''}${memoryContext}`;
```

To:

```typescript
Reply in the same language as the guest message. Do not start with "Of course" or "Certainly".${propertyFactsContext ? `\n\n${propertyFactsContext}` : ''}${knowledgeContext ? `\n\n${knowledgeContext}` : ''}${memoryContext}`;
```

- [ ] **Step 2: Run typecheck**

Run:
```bash
pnpm turbo run typecheck --filter=@walt/web
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/generate-reply-suggestion.ts
git commit -m "feat: inject structured property facts into AI prompt before knowledge entries"
```

---

### Task 5: Cleanup — Update property-context.ts to use columns

**Files:**
- Modify: `apps/web/src/lib/seo-drafts/property-context.ts`

- [ ] **Step 1: Refactor to use columns instead of raw blob**

Replace the `rawToSummary` and `isFriscoProperty` functions and update the query to use the `description` and `summary` columns. Keep checking `city` and `address` for "frisco" to preserve existing detection behavior:

```typescript
import { asc } from 'drizzle-orm';
import { properties } from '@walt/db';

import { db } from '@/lib/db';

export type FriscoPropertyContext = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  summary: string;
};

export async function getFriscoPropertyContext(): Promise<FriscoPropertyContext[]> {
  const rows = await db
    .select({
      id: properties.id,
      name: properties.name,
      city: properties.city,
      address: properties.address,
      addressState: properties.addressState,
      description: properties.description,
      summary: properties.summary,
    })
    .from(properties)
    .orderBy(asc(properties.name));

  return rows
    .filter(
      (row) =>
        row.city?.toLowerCase().includes('frisco') ||
        row.address?.toLowerCase().includes('frisco') ||
        row.addressState?.toLowerCase() === 'tx',
    )
    .map((row) => ({
      id: row.id,
      name: row.name,
      city: row.city ?? null,
      address: row.address ?? null,
      summary:
        row.description ??
        row.summary ??
        (row.address ? `${row.name} near ${row.address}` : row.name),
    }));
}
```

- [ ] **Step 2: Run typecheck**

Run:
```bash
pnpm turbo run typecheck --filter=@walt/web
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/seo-drafts/property-context.ts
git commit -m "refactor: use property columns instead of raw JSONB in property-context"
```

---

### Task 6: UI — Property "Details" tab

**Files:**
- Create: `apps/web/src/app/properties/[id]/details/page.tsx`
- Modify: `apps/web/src/app/properties/[id]/PropertySettingsTabs.tsx`

- [ ] **Step 1: Add "Details" tab to PropertySettingsTabs**

Update `apps/web/src/app/properties/[id]/PropertySettingsTabs.tsx` to add the Details tab as the first tab and include it in the type:

```typescript
import Link from 'next/link';

export function PropertySettingsTabs({
  propertyId,
  current,
}: {
  propertyId: string;
  current: 'details' | 'agent' | 'knowledge' | 'appliances';
}) {
  const tabs = [
    { href: `/properties/${propertyId}/details`, label: 'Details' },
    { href: `/properties/${propertyId}/agent`, label: 'Agent' },
    { href: `/properties/${propertyId}/knowledge`, label: 'Knowledge' },
    { href: `/properties/${propertyId}/appliances`, label: 'Appliances' },
  ] as const;

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = tab.href.endsWith(`/${current}`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create the Details page**

Create `apps/web/src/app/properties/[id]/details/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { properties } from '@walt/db';
import { db } from '@/lib/db';
import { PropertySettingsTabs } from '../PropertySettingsTabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'destructive' }) {
  const styles = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-700',
    destructive: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
}

function RuleBadge({ label, allowed }: { label: string; allowed: boolean | null }) {
  if (allowed === null) return null;
  return (
    <Badge variant={allowed ? 'success' : 'destructive'}>
      {allowed ? `${label} allowed` : `No ${label.toLowerCase()}`}
    </Badge>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default async function PropertyDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1);

  if (!property) {
    notFound();
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <Link
        href="/properties"
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-flex items-center gap-1"
      >
        &larr; Properties
      </Link>
      <h1 className="text-2xl font-bold mt-4 mb-1">{property.name}</h1>
      {property.publicName && property.publicName !== property.name && (
        <p className="text-sm text-gray-500 mb-4">{property.publicName}</p>
      )}
      <p className="text-xs text-gray-400 mb-6">
        Last synced: {property.syncedAt.toLocaleString()}
      </p>

      <PropertySettingsTabs propertyId={id} current="details" />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Overview */}
        <Card>
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent>
            {property.pictureUrl && (
              <img
                src={property.pictureUrl}
                alt={property.name}
                className="w-full h-48 object-cover rounded-md mb-4"
              />
            )}
            <DetailRow label="Property type" value={property.propertyType} />
            <DetailRow label="Room type" value={property.roomType} />
            <DetailRow label="Currency" value={property.currency} />
            {property.description && (
              <div className="mt-3">
                <p className="text-sm text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{property.description}</p>
              </div>
            )}
            {property.summary && property.summary !== property.description && (
              <div className="mt-3">
                <p className="text-sm text-gray-500 mb-1">Summary</p>
                <p className="text-sm text-gray-700">{property.summary}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Capacity */}
        <Card>
          <CardHeader><CardTitle>Capacity</CardTitle></CardHeader>
          <CardContent>
            <DetailRow label="Max guests" value={property.maxGuests} />
            <DetailRow label="Bedrooms" value={property.bedrooms} />
            <DetailRow label="Beds" value={property.beds} />
            <DetailRow label="Bathrooms" value={property.bathrooms} />
            {property.roomDetails && property.roomDetails.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-gray-500 mb-1">Room details</p>
                <div className="flex flex-wrap gap-1">
                  {property.roomDetails.map((rd, i) => (
                    <Badge key={i}>{rd.quantity}x {rd.type}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timing */}
        <Card>
          <CardHeader><CardTitle>Timing</CardTitle></CardHeader>
          <CardContent>
            <DetailRow label="Check-in" value={property.checkInTime} />
            <DetailRow label="Check-out" value={property.checkOutTime} />
            <DetailRow label="Timezone" value={property.timezone} />
          </CardContent>
        </Card>

        {/* House Rules */}
        <Card>
          <CardHeader><CardTitle>House Rules</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <RuleBadge label="Pets" allowed={property.petsAllowed} />
              <RuleBadge label="Smoking" allowed={property.smokingAllowed} />
              <RuleBadge label="Events" allowed={property.eventsAllowed} />
            </div>
            {property.petsAllowed === null && property.smokingAllowed === null && property.eventsAllowed === null && (
              <p className="text-sm text-gray-400 mt-2">No house rules data available.</p>
            )}
          </CardContent>
        </Card>

        {/* Amenities */}
        {property.amenities && property.amenities.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Amenities</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {property.amenities.map((a) => (
                  <Badge key={a}>{a}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Location */}
        <Card>
          <CardHeader><CardTitle>Location</CardTitle></CardHeader>
          <CardContent>
            <DetailRow label="Street" value={property.address} />
            <DetailRow label="Number" value={property.addressNumber} />
            <DetailRow label="City" value={property.city} />
            <DetailRow label="State" value={property.addressState} />
            <DetailRow label="Country" value={property.country} />
            <DetailRow label="Postcode" value={property.postcode} />
            {property.latitude != null && property.longitude != null && (
              <DetailRow label="Coordinates" value={`${property.latitude}, ${property.longitude}`} />
            )}
          </CardContent>
        </Card>

        {/* Platforms */}
        {property.listings && property.listings.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Connected Platforms</CardTitle></CardHeader>
            <CardContent>
              {property.listings.map((listing, i) => (
                <DetailRow
                  key={i}
                  label={listing.platform}
                  value={listing.platform_name ?? listing.platform_id}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Meta */}
        {(property.tags?.length || property.calendarRestricted != null || property.parentChild) && (
          <Card>
            <CardHeader><CardTitle>Meta</CardTitle></CardHeader>
            <CardContent>
              <DetailRow label="Calendar restricted" value={property.calendarRestricted != null ? (property.calendarRestricted ? 'Yes' : 'No') : null} />
              {property.tags && property.tags.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-gray-500 mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {property.tags.map((t) => <Badge key={t}>{t}</Badge>)}
                  </div>
                </div>
              )}
              {property.parentChild && (
                <DetailRow label="Relationship" value={property.parentChild.type} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck and lint**

Run:
```bash
pnpm turbo run typecheck lint --filter=@walt/web
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/properties/[id]/details/ apps/web/src/app/properties/[id]/PropertySettingsTabs.tsx
git commit -m "feat: add read-only property listing details tab"
```

---

### Task 7: Build verification and backfill

- [ ] **Step 1: Run full build**

Run:
```bash
pnpm turbo run typecheck lint build --filter=@walt/web
```

Expected: ALL PASS

- [ ] **Step 2: Run all tests**

Run:
```bash
cd apps/web && npx tsx --test src/lib/hospitable-normalize.test.ts src/lib/property-facts.test.ts
```

Expected: ALL PASS

- [ ] **Step 3: Trigger backfill sync**

After deploying, trigger a one-time sync to populate the new columns for existing properties:

```bash
curl -X POST http://localhost:3000/api/admin/sync-hospitable
```

Expected: Properties table rows now have all 30 new columns populated from the Hospitable API.

- [ ] **Step 4: Commit any remaining changes**

```bash
git status
# If any uncommitted changes remain:
git add -A && git commit -m "chore: final cleanup for property field extraction"
```
