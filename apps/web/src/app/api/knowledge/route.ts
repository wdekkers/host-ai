import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  createKnowledgeEntryInputSchema,
  type KnowledgeChannel,
  type KnowledgeEntryType,
  knowledgeListQuerySchema,
  type KnowledgeScope,
  type KnowledgeStatus,
  updateKnowledgeEntryInputSchema,
} from '@walt/contracts';
import { knowledgeEntries } from '@walt/db';

import { withPermission } from '@/lib/auth/authorize';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/secure-logger';

type Params = { params: Promise<{ id: string }> };
type KnowledgeEntryRow = typeof knowledgeEntries.$inferSelect;

type KnowledgeListArgs = {
  orgId: string;
  scope: KnowledgeScope;
  propertyId?: string | null;
  entryType?: KnowledgeEntryType;
  channel?: KnowledgeChannel;
  status?: KnowledgeStatus;
  topicKey?: string;
};

type KnowledgeCreateValues = {
  organizationId: string;
  scope: KnowledgeScope;
  propertyId: string | null;
  entryType: KnowledgeEntryType;
  topicKey: string;
  title: string | null;
  question: string | null;
  answer: string | null;
  body: string | null;
  channels: KnowledgeChannel[];
  status: KnowledgeStatus;
  sortOrder: number;
  slug: string | null;
};

type KnowledgePatchValues = Partial<
  Omit<
    KnowledgeCreateValues,
    'organizationId' | 'scope' | 'propertyId' | 'entryType' | 'topicKey' | 'channels'
  >
> & {
  entryType?: KnowledgeEntryType;
  topicKey?: string;
  channels?: KnowledgeChannel[];
};

type KnowledgeRouteDependencies = {
  queryKnowledgeEntries?: (args: KnowledgeListArgs) => Promise<KnowledgeEntryRow[]>;
  getKnowledgeEntryById?: (args: {
    orgId: string;
    knowledgeId: string;
  }) => Promise<KnowledgeEntryRow | null>;
  createKnowledgeEntry?: (values: KnowledgeCreateValues) => Promise<KnowledgeEntryRow>;
  patchKnowledgeEntry?: (args: {
    orgId: string;
    knowledgeId: string;
    scope: KnowledgeScope;
    propertyId?: string | null;
    values: KnowledgePatchValues;
  }) => Promise<KnowledgeEntryRow | null>;
};

function sortKnowledgeEntries(entries: KnowledgeEntryRow[]) {
  return [...entries].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.topicKey.localeCompare(b.topicKey);
  });
}

function mergeKnowledgeEntries(
  globalEntries: KnowledgeEntryRow[],
  propertyEntries: KnowledgeEntryRow[],
) {
  const merged = new Map<string, KnowledgeEntryRow>();
  for (const entry of globalEntries) merged.set(entry.topicKey, entry);
  for (const entry of propertyEntries) merged.set(entry.topicKey, entry);
  return sortKnowledgeEntries(Array.from(merged.values()));
}

async function queryKnowledgeEntries(
  {
    orgId,
    scope,
    propertyId,
    entryType,
    channel,
    status,
    topicKey,
  }: KnowledgeListArgs,
  deps: KnowledgeRouteDependencies = {},
): Promise<KnowledgeEntryRow[]> {
  const query =
    deps.queryKnowledgeEntries ??
    (async (args: KnowledgeListArgs) => {
      const filters = [eq(knowledgeEntries.organizationId, args.orgId), eq(knowledgeEntries.scope, args.scope)];

      if (args.propertyId === null) {
        filters.push(isNull(knowledgeEntries.propertyId));
      } else if (args.propertyId) {
        filters.push(eq(knowledgeEntries.propertyId, args.propertyId));
      }

      if (args.entryType) {
        filters.push(eq(knowledgeEntries.entryType, args.entryType));
      }

      if (args.status) {
        filters.push(eq(knowledgeEntries.status, args.status));
      }

      if (args.topicKey) {
        filters.push(eq(knowledgeEntries.topicKey, args.topicKey));
      }

      if (args.channel) {
        filters.push(sql`${knowledgeEntries.channels} @> ARRAY[${args.channel}]::text[]`);
      }

      return db
        .select()
        .from(knowledgeEntries)
        .where(and(...filters))
        .orderBy(knowledgeEntries.sortOrder, knowledgeEntries.topicKey);
    });

  return query({ orgId, scope, propertyId, entryType, channel, status, topicKey });
}

async function createKnowledgeEntryRecord(
  values: KnowledgeCreateValues,
  deps: KnowledgeRouteDependencies = {},
): Promise<KnowledgeEntryRow> {
  const createKnowledgeEntry =
    deps.createKnowledgeEntry ??
    (async (input: KnowledgeCreateValues) => {
      const now = new Date();
      const [created] = await db
        .insert(knowledgeEntries)
        .values({
          id: uuidv4(),
          organizationId: input.organizationId,
          scope: input.scope,
          propertyId: input.propertyId,
          entryType: input.entryType,
          topicKey: input.topicKey,
          title: input.title,
          question: input.question,
          answer: input.answer,
          body: input.body,
          channels: input.channels,
          status: input.status,
          sortOrder: input.sortOrder,
          slug: input.slug,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created) {
        throw new Error('Failed to create knowledge entry');
      }
      return created;
    });

  return createKnowledgeEntry(values);
}

async function patchKnowledgeEntryRecord(
  orgId: string,
  knowledgeId: string,
  scope: KnowledgeScope,
  propertyId: string | null,
  values: KnowledgePatchValues,
  deps: KnowledgeRouteDependencies = {},
): Promise<KnowledgeEntryRow | null> {
  const patchKnowledgeEntry =
    deps.patchKnowledgeEntry ??
      (async (args: {
      orgId: string;
      knowledgeId: string;
      scope: KnowledgeScope;
      propertyId?: string | null;
      values: KnowledgePatchValues;
    }) => {
      const now = new Date();
      const filters = [
        eq(knowledgeEntries.organizationId, args.orgId),
        eq(knowledgeEntries.id, args.knowledgeId),
        eq(knowledgeEntries.scope, args.scope),
      ];
      if (args.scope === 'global') {
        filters.push(isNull(knowledgeEntries.propertyId));
      } else if (args.propertyId) {
        filters.push(eq(knowledgeEntries.propertyId, args.propertyId));
      }
      const [updated] = await db
        .update(knowledgeEntries)
        .set({ ...args.values, updatedAt: now })
        .where(and(...filters))
        .returning();
      return updated ?? null;
    });

  return patchKnowledgeEntry({ orgId, knowledgeId, scope, propertyId, values });
}

function normalizeGlobalCreateBody(body: unknown) {
  return createKnowledgeEntryInputSchema.parse({ ...(body as Record<string, unknown>), scope: 'global', propertyId: null });
}

function normalizePropertyCreateBody(body: unknown, propertyId: string) {
  return createKnowledgeEntryInputSchema.parse({
    ...(body as Record<string, unknown>),
    scope: 'property',
    propertyId,
  });
}

function normalizePatchBody(body: unknown, scope: KnowledgeScope, propertyId: string | null) {
  return updateKnowledgeEntryInputSchema.parse({
    ...(body as Record<string, unknown>),
    scope,
    propertyId,
  });
}

export async function handleListKnowledgeEntries(
  request: Request,
  authContext: Pick<{ orgId: string }, 'orgId'>,
  deps: KnowledgeRouteDependencies = {},
) {
  try {
    const url = new URL(request.url);
    const parsed = knowledgeListQuerySchema.parse({
      scope: (url.searchParams.get('scope') ?? 'global') as KnowledgeScope,
      propertyId: url.searchParams.get('propertyId') ?? undefined,
      entryType: url.searchParams.get('entryType') ?? undefined,
      channel: url.searchParams.get('channel') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      topicKey: url.searchParams.get('topicKey') ?? undefined,
    });

    const items = await queryKnowledgeEntries(
      {
        orgId: authContext.orgId,
        scope: parsed.scope ?? 'global',
        propertyId: parsed.propertyId ?? null,
        entryType: parsed.entryType,
        channel: parsed.channel,
        status: parsed.status,
        topicKey: parsed.topicKey,
      },
      deps,
    );

    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError({ error, route: '/api/knowledge' });
  }
}

export async function handleCreateKnowledgeEntry(
  request: Request,
  authContext: Pick<{ orgId: string }, 'orgId'>,
  deps: KnowledgeRouteDependencies = {},
) {
  try {
    const parsed = normalizeGlobalCreateBody(await request.json());
    const item = await createKnowledgeEntryRecord(
      {
        organizationId: authContext.orgId,
        scope: 'global',
        propertyId: null,
        entryType: parsed.entryType,
        topicKey: parsed.topicKey,
        title: parsed.title ?? null,
        question: parsed.question ?? null,
        answer: parsed.answer ?? null,
        body: parsed.body ?? null,
        channels: parsed.channels,
        status: parsed.status ?? 'draft',
        sortOrder: parsed.sortOrder ?? 0,
        slug: parsed.slug ?? null,
      },
      deps,
    );

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return handleApiError({ error, route: '/api/knowledge POST' });
  }
}

export async function handlePatchKnowledgeEntry(
  request: Request,
  { params }: Params,
  authContext: Pick<{ orgId: string }, 'orgId'>,
  deps: KnowledgeRouteDependencies = {},
) {
  try {
    const { id: knowledgeId } = await params;
    const parsed = normalizePatchBody(await request.json(), 'global', null);
    delete parsed.topicKey;
    const item = await patchKnowledgeEntryRecord(
      authContext.orgId,
      knowledgeId,
      'global',
      null,
      parsed,
      deps,
    );

    if (!item) {
      return NextResponse.json({ error: 'Knowledge entry not found' }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    return handleApiError({ error, route: '/api/knowledge/[id] PATCH' });
  }
}

export async function handleListPropertyKnowledgeEntries(
  request: Request,
  { params }: Params,
  authContext: Pick<{ orgId: string }, 'orgId'>,
  deps: KnowledgeRouteDependencies = {},
) {
  try {
    const { id: propertyId } = await params;
    const url = new URL(request.url);
    const query = knowledgeListQuerySchema.parse({
      scope: 'property',
      propertyId,
      entryType: url.searchParams.get('entryType') ?? undefined,
      channel: url.searchParams.get('channel') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      topicKey: url.searchParams.get('topicKey') ?? undefined,
    });
    const includeInherited = url.searchParams.get('includeInherited') !== 'false';

    const propertyEntries = await queryKnowledgeEntries(
      {
        orgId: authContext.orgId,
        scope: 'property',
        propertyId: query.propertyId ?? propertyId,
        entryType: query.entryType,
        channel: query.channel,
        status: query.status,
        topicKey: query.topicKey,
      },
      deps,
    );

    const globalEntries = includeInherited
      ? await queryKnowledgeEntries(
          {
            orgId: authContext.orgId,
            scope: 'global',
            propertyId: null,
            entryType: query.entryType,
            channel: query.channel,
            status: query.status,
            topicKey: query.topicKey,
          },
          deps,
        )
      : [];

    const items = includeInherited
      ? mergeKnowledgeEntries(globalEntries, propertyEntries)
      : sortKnowledgeEntries(propertyEntries);

    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError({ error, route: '/api/properties/[id]/knowledge' });
  }
}

export async function handleCreatePropertyKnowledgeEntry(
  request: Request,
  { params }: Params,
  authContext: Pick<{ orgId: string }, 'orgId'>,
  deps: KnowledgeRouteDependencies = {},
) {
  try {
    const { id: propertyId } = await params;
    const parsed = normalizePropertyCreateBody(await request.json(), propertyId);
    const item = await createKnowledgeEntryRecord(
      {
        organizationId: authContext.orgId,
        scope: 'property',
        propertyId,
        entryType: parsed.entryType,
        topicKey: parsed.topicKey,
        title: parsed.title ?? null,
        question: parsed.question ?? null,
        answer: parsed.answer ?? null,
        body: parsed.body ?? null,
        channels: parsed.channels,
        status: parsed.status ?? 'draft',
        sortOrder: parsed.sortOrder ?? 0,
        slug: parsed.slug ?? null,
      },
      deps,
    );

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return handleApiError({ error, route: '/api/properties/[id]/knowledge POST' });
  }
}

export async function handlePatchPropertyKnowledgeEntry(
  request: Request,
  { params }: Params & { params: Promise<{ id: string; entryId: string }> },
  authContext: Pick<{ orgId: string }, 'orgId'>,
  deps: KnowledgeRouteDependencies = {},
) {
  try {
    const { id: propertyId, entryId } = await params;
    const parsed = normalizePatchBody(await request.json(), 'property', propertyId);
    delete parsed.topicKey;
    const item = await patchKnowledgeEntryRecord(
      authContext.orgId,
      entryId,
      'property',
      propertyId,
      parsed,
      deps,
    );

    if (!item) {
      return NextResponse.json({ error: 'Property knowledge entry not found' }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    return handleApiError({ error, route: '/api/properties/[id]/knowledge/[entryId] PATCH' });
  }
}

export async function handleOverridePropertyKnowledgeEntry(
  _request: Request,
  { params }: Params & { params: Promise<{ id: string; entryId: string }> },
  authContext: Pick<{ orgId: string }, 'orgId'>,
  deps: KnowledgeRouteDependencies = {},
) {
  try {
    const { id: propertyId, entryId } = await params;
    const source =
      (await (deps.getKnowledgeEntryById ??
        (async ({ orgId, knowledgeId }: { orgId: string; knowledgeId: string }) => {
          const [entry] = await db
            .select()
            .from(knowledgeEntries)
            .where(and(eq(knowledgeEntries.organizationId, orgId), eq(knowledgeEntries.id, knowledgeId)))
            .limit(1);
          return entry ?? null;
        }))({ orgId: authContext.orgId, knowledgeId: entryId })) ?? null;

    if (!source || source.scope !== 'global') {
      return NextResponse.json({ error: 'Global knowledge entry not found' }, { status: 404 });
    }

    const [existingOverride] = await queryKnowledgeEntries(
      {
        orgId: authContext.orgId,
        scope: 'property',
        propertyId,
        topicKey: source.topicKey,
      },
      deps,
    );

    if (existingOverride) {
      const item = await patchKnowledgeEntryRecord(
        authContext.orgId,
        existingOverride.id,
        'property',
        propertyId,
        {
          entryType: source.entryType as KnowledgeEntryType,
          title: source.title ?? undefined,
          question: source.question ?? undefined,
          answer: source.answer ?? undefined,
          body: source.body ?? undefined,
          channels: source.channels as KnowledgeChannel[],
          status: 'draft',
          sortOrder: source.sortOrder,
          slug: source.slug ?? undefined,
        },
        deps,
      );

      if (!item) {
        throw new Error('Failed to update property knowledge override');
      }

      return NextResponse.json({ item });
    }

    const item = await createKnowledgeEntryRecord(
      {
        organizationId: authContext.orgId,
        scope: 'property',
        propertyId,
        entryType: source.entryType as KnowledgeEntryType,
        topicKey: source.topicKey,
        title: source.title,
        question: source.question,
        answer: source.answer,
        body: source.body,
        channels: source.channels as KnowledgeChannel[],
        status: 'draft',
        sortOrder: source.sortOrder,
        slug: source.slug,
      },
      deps,
    );

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return handleApiError({ error, route: '/api/properties/[id]/knowledge/[entryId]/override POST' });
  }
}

export const GET = withPermission('dashboard.read', async (request: Request, _context, auth) =>
  handleListKnowledgeEntries(request, auth),
);

export const POST = withPermission('ops.write', async (request: Request, _context, auth) =>
  handleCreateKnowledgeEntry(request, auth),
);
