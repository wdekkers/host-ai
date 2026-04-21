import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  pricelabsCredentials,
  pricelabsListings,
  properties,
  propertyAccess,
} from '@walt/db';
import { createPriceLabsClient, type PriceLabsClient } from '@walt/pricelabs';

import { decryptApiKey } from '@/lib/pricelabs/encryption';
import { autoMatchListings } from '@/lib/pricelabs/auto-match';
import { requirePermission } from '@/lib/auth/authorize';

// `integrations.read` is the only integrations-scoped permission currently
// defined in `@walt/contracts`; owners implicitly have all permissions and
// managers are explicitly granted it in `lib/auth/permissions.ts`.
const INTEGRATIONS_PERMISSION = 'integrations.read' as const;

export type Actor = { userId: string; orgId: string; role: string };

export type StoredCredentials = {
  fingerprint: string;
  status: string;
  encryptedApiKey: string;
};

export type InternalPropertyRow = { id: string; name: string };

export type StoredMappingRow = {
  pricelabsListingId: string;
  propertyId: string | null;
  status: string;
  matchConfidence: string | null;
};

export type MappingUpsertRow = {
  orgId: string;
  pricelabsListingId: string;
  pricelabsListingName: string;
  propertyId: string | null;
  status: 'active' | 'unmapped' | 'inactive';
  matchConfidence: 'manual';
};

export type GetDeps = {
  // Test-only override. Production callers go through `requirePermission`.
  getActor?: (req: Request) => Promise<Actor | null>;
  getCredentials?: (orgId: string) => Promise<StoredCredentials | null>;
  decryptKey?: (encrypted: string) => string;
  createClient?: (apiKey: string) => PriceLabsClient;
  getProperties?: (orgId: string) => Promise<InternalPropertyRow[]>;
  getStoredMappings?: (orgId: string) => Promise<StoredMappingRow[]>;
};

export type SaveDeps = {
  // Test-only override. Production callers go through `requirePermission`.
  getActor?: (req: Request) => Promise<Actor | null>;
  upsertMappings?: (rows: MappingUpsertRow[]) => Promise<void>;
};

async function resolveActor(
  req: Request,
  override: ((req: Request) => Promise<Actor | null>) | undefined,
): Promise<Actor | Response> {
  if (override) {
    const actor = await override(req);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Mirror `requirePermission`'s 403 for test actors without the permission.
    // Only owners/managers have `integrations.read` today.
    const allowed = actor.role === 'owner' || actor.role === 'manager';
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return actor;
  }
  const ctxOrResponse = await requirePermission(req, INTEGRATIONS_PERMISSION);
  if (ctxOrResponse instanceof Response) {
    return ctxOrResponse;
  }
  return {
    userId: ctxOrResponse.userId,
    orgId: ctxOrResponse.orgId,
    role: ctxOrResponse.role,
  };
}

export async function handleGetMappings(
  req: Request,
  deps: GetDeps = {},
): Promise<Response> {
  const actorOrResponse = await resolveActor(req, deps.getActor);
  if (actorOrResponse instanceof Response) {
    return actorOrResponse;
  }
  const actor = actorOrResponse;

  const getCredentials =
    deps.getCredentials ??
    (async (orgId: string) => {
      const { db } = await import('@/lib/db');
      const [row] = await db
        .select({
          fingerprint: pricelabsCredentials.apiKeyFingerprint,
          status: pricelabsCredentials.status,
          encryptedApiKey: pricelabsCredentials.encryptedApiKey,
        })
        .from(pricelabsCredentials)
        .where(eq(pricelabsCredentials.orgId, orgId))
        .limit(1);
      return row ?? null;
    });

  const creds = await getCredentials(actor.orgId);
  if (!creds) {
    return NextResponse.json({ state: 'not_connected' });
  }
  if (creds.status === 'invalid') {
    return NextResponse.json({
      state: 'key_invalid',
      fingerprint: creds.fingerprint,
    });
  }

  const apiKey = (deps.decryptKey ?? decryptApiKey)(creds.encryptedApiKey);
  const client = (deps.createClient ?? ((k) => createPriceLabsClient({ apiKey: k })))(apiKey);
  const listings = await client.listListings();

  const getProperties =
    deps.getProperties ??
    (async (orgId: string) => {
      const { db } = await import('@/lib/db');
      const rows = await db
        .select({ id: properties.id, name: properties.name })
        .from(properties)
        .innerJoin(propertyAccess, eq(propertyAccess.propertyId, properties.id))
        .where(eq(propertyAccess.organizationId, orgId));
      return rows;
    });

  const getStored =
    deps.getStoredMappings ??
    (async (orgId: string) => {
      const { db } = await import('@/lib/db');
      const rows = await db
        .select({
          pricelabsListingId: pricelabsListings.pricelabsListingId,
          propertyId: pricelabsListings.propertyId,
          status: pricelabsListings.status,
          matchConfidence: pricelabsListings.matchConfidence,
        })
        .from(pricelabsListings)
        .where(eq(pricelabsListings.orgId, orgId));
      return rows;
    });

  const [props, stored] = await Promise.all([
    getProperties(actor.orgId),
    getStored(actor.orgId),
  ]);
  const storedByListing = new Map(stored.map((r) => [r.pricelabsListingId, r]));

  const unmappedListings = listings
    .filter((l) => !storedByListing.has(l.id))
    .map((l) => ({ id: l.id, name: l.name }));
  const takenProps = new Set(
    stored.filter((r) => r.propertyId).map((r) => r.propertyId as string),
  );
  const availableProps = props.filter((p) => !takenProps.has(p.id));
  const autoMatches = autoMatchListings(unmappedListings, availableProps);
  const autoByListing = new Map(autoMatches.map((m) => [m.pricelabsListingId, m]));

  const rows = listings.map((l) => {
    const saved = storedByListing.get(l.id);
    if (saved) {
      return {
        pricelabsListingId: l.id,
        pricelabsListingName: l.name,
        propertyId: saved.propertyId,
        status: saved.status,
        matchConfidence: saved.matchConfidence,
      };
    }
    const auto = autoByListing.get(l.id);
    return {
      pricelabsListingId: l.id,
      pricelabsListingName: l.name,
      propertyId: auto?.propertyId ?? null,
      status: 'unmapped' as const,
      matchConfidence: auto?.confidence ?? null,
    };
  });

  return NextResponse.json({
    state: 'connected',
    fingerprint: creds.fingerprint,
    rows,
  });
}

const SaveBody = z.object({
  mappings: z
    .array(
      z.object({
        pricelabsListingId: z.string().min(1),
        pricelabsListingName: z.string().min(1),
        propertyId: z.string().nullable(),
        status: z.enum(['active', 'unmapped', 'inactive']),
      }),
    )
    .min(0),
});

export async function handleSaveMappings(
  req: Request,
  deps: SaveDeps = {},
): Promise<Response> {
  const actorOrResponse = await resolveActor(req, deps.getActor);
  if (actorOrResponse instanceof Response) {
    return actorOrResponse;
  }
  const actor = actorOrResponse;

  const json = await req.json().catch(() => null);
  const parsed = SaveBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'invalid body' },
      { status: 400 },
    );
  }

  const rows: MappingUpsertRow[] = parsed.data.mappings.map((m) => ({
    orgId: actor.orgId,
    pricelabsListingId: m.pricelabsListingId,
    pricelabsListingName: m.pricelabsListingName,
    propertyId: m.propertyId,
    status: m.status,
    matchConfidence: 'manual' as const,
  }));

  const upsert =
    deps.upsertMappings ??
    (async (rowsToInsert: MappingUpsertRow[]) => {
      const { db } = await import('@/lib/db');
      for (const r of rowsToInsert) {
        await db
          .insert(pricelabsListings)
          .values({
            orgId: r.orgId,
            pricelabsListingId: r.pricelabsListingId,
            pricelabsListingName: r.pricelabsListingName,
            propertyId: r.propertyId,
            status: r.status,
            matchConfidence: r.matchConfidence,
          })
          .onConflictDoUpdate({
            target: [pricelabsListings.orgId, pricelabsListings.pricelabsListingId],
            set: {
              pricelabsListingName: r.pricelabsListingName,
              propertyId: r.propertyId,
              status: r.status,
              matchConfidence: r.matchConfidence,
              updatedAt: new Date(),
            },
          });
      }
    });

  await upsert(rows);
  return NextResponse.json({ ok: true, count: rows.length });
}
