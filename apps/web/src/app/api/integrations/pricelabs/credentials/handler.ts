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
import { getAuthContext } from '@/lib/auth/get-auth-context';

const ALLOWED_ROLES: ReadonlySet<string> = new Set(['owner', 'manager']);

export type Actor = { userId: string; orgId: string; role: string };

export type SaveDeps = {
  getActor?: (req: Request) => Promise<Actor | null>;
  createClient?: (apiKey: string) => PriceLabsClient;
  upsertCredentials?: (row: {
    orgId: string;
    encryptedApiKey: string;
    apiKeyFingerprint: string;
  }) => Promise<void>;
};

export type DeleteDeps = {
  getActor?: (req: Request) => Promise<Actor | null>;
  deleteCredentials?: (orgId: string) => Promise<void>;
};

const BodySchema = z.object({
  apiKey: z.string().trim().min(1, 'apiKey is required'),
});

async function defaultGetActor(req: Request): Promise<Actor | null> {
  const ctx = await getAuthContext(req);
  if (!ctx) return null;
  return { userId: ctx.userId, orgId: ctx.orgId, role: ctx.role };
}

function isAuthRejected(err: unknown): boolean {
  if (err instanceof PriceLabsError && err.code === 'auth_rejected') return true;
  if (typeof err === 'object' && err !== null) {
    const maybe = err as { name?: unknown; code?: unknown };
    if (maybe.name === 'PriceLabsError' && maybe.code === 'auth_rejected') return true;
  }
  return false;
}

export async function handleSaveCredentials(
  req: Request,
  deps: SaveDeps = {},
): Promise<Response> {
  const actor = await (deps.getActor ?? defaultGetActor)(req);
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.has(actor.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
    if (isAuthRejected(err)) {
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
  const actor = await (deps.getActor ?? defaultGetActor)(req);
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.has(actor.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const del =
    deps.deleteCredentials ??
    (async (orgId) => {
      const { db } = await import('@/lib/db');
      await db.delete(pricelabsCredentials).where(eq(pricelabsCredentials.orgId, orgId));
    });
  await del(actor.orgId);
  return new Response(null, { status: 204 });
}
