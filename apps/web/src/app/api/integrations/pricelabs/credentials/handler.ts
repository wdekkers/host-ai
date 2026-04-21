import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { pricelabsCredentials } from '@walt/db';
import {
  createPriceLabsClient,
  PriceLabsError,
  type PriceLabsClient,
} from '@walt/pricelabs';

import { encryptApiKey, keyFingerprint } from '@/lib/pricelabs/encryption';
import { resolveActor, type Actor } from '@/lib/auth/resolve-actor';

// `integrations.read` is the only integrations-scoped permission currently
// defined in `@walt/contracts`; owners implicitly have all permissions and
// managers are explicitly granted it in `lib/auth/permissions.ts`.
const INTEGRATIONS_PERMISSION = 'integrations.read' as const;

export type { Actor };

export type SaveDeps = {
  // Test-only override. Production callers go through `requirePermission`.
  getActor?: (req: Request) => Promise<Actor | null>;
  createClient?: (apiKey: string) => PriceLabsClient;
  upsertCredentials?: (row: {
    orgId: string;
    encryptedApiKey: string;
    apiKeyFingerprint: string;
  }) => Promise<void>;
};

export type DeleteDeps = {
  // Test-only override. Production callers go through `requirePermission`.
  getActor?: (req: Request) => Promise<Actor | null>;
  deleteCredentials?: (orgId: string) => Promise<void>;
};

const BodySchema = z.object({
  apiKey: z.string().trim().min(1, 'apiKey is required'),
});

export async function handleSaveCredentials(
  req: Request,
  deps: SaveDeps = {},
): Promise<Response> {
  const actorOrResponse = await resolveActor(req, INTEGRATIONS_PERMISSION, deps.getActor);
  if (actorOrResponse instanceof Response) {
    return actorOrResponse;
  }
  const actor = actorOrResponse;

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'invalid body' },
      { status: 400 },
    );
  }

  const client = (deps.createClient ?? ((k) => createPriceLabsClient({ apiKey: k })))(
    parsed.data.apiKey,
  );
  try {
    await client.listListings();
  } catch (err) {
    if (err instanceof PriceLabsError && err.code === 'auth_rejected') {
      return NextResponse.json(
        { error: 'PriceLabs rejected the API key' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Could not reach PriceLabs' }, { status: 502 });
  }

  const upsert =
    deps.upsertCredentials ??
    (async (row) => {
      const { db } = await import('@/lib/db');
      await db
        .insert(pricelabsCredentials)
        .values({
          orgId: row.orgId,
          encryptedApiKey: row.encryptedApiKey,
          apiKeyFingerprint: row.apiKeyFingerprint,
          status: 'active',
        })
        .onConflictDoUpdate({
          target: pricelabsCredentials.orgId,
          set: {
            encryptedApiKey: row.encryptedApiKey,
            apiKeyFingerprint: row.apiKeyFingerprint,
            status: 'active',
            updatedAt: new Date(),
          },
        });
    });

  const fingerprint = keyFingerprint(parsed.data.apiKey);
  await upsert({
    orgId: actor.orgId,
    encryptedApiKey: encryptApiKey(parsed.data.apiKey),
    apiKeyFingerprint: fingerprint,
  });

  return NextResponse.json({ ok: true, fingerprint });
}

export async function handleDeleteCredentials(
  req: Request,
  deps: DeleteDeps = {},
): Promise<Response> {
  const actorOrResponse = await resolveActor(req, INTEGRATIONS_PERMISSION, deps.getActor);
  if (actorOrResponse instanceof Response) {
    return actorOrResponse;
  }
  const actor = actorOrResponse;

  const del =
    deps.deleteCredentials ??
    (async (orgId) => {
      const { db } = await import('@/lib/db');
      await db.delete(pricelabsCredentials).where(eq(pricelabsCredentials.orgId, orgId));
    });
  await del(actor.orgId);
  return new Response(null, { status: 204 });
}
