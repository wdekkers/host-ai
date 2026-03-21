import { and, asc, desc, eq, sql } from 'drizzle-orm';
import {
  properties,
  propertyAccess,
  seoDrafts,
  seoEventCandidates,
  seoOpportunities,
  seoPipelineRuns,
} from '@walt/db';

import { DraftReviewActions } from './DraftReviewActions';
import { RunSeoDraftsButton } from './RunSeoDraftsButton';
import { SyncPropertiesButton } from './SyncPropertiesButton';

import { hasPermission } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth/get-auth-context';

type SourceFailure = {
  sourceId: string;
  sourceUrl: string;
  message: string;
};

type DraftRow = {
  id: string;
  status: string;
  titleTag: string;
  slug: string;
  generatedAt: Date;
  updatedAt: Date;
  reviewNotes: string[];
  sourceUrls: string[];
  targetKeyword: string;
  score: number;
  eventTitle: string;
  sourceUrl: string;
  runStatus: string;
  runMetadata: unknown;
};

type PropertyRow = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  raw: Record<string, unknown>;
};

const MARKET_KEY = 'frisco-tx';
const SITE_KEY = 'stayinfrisco';

function formatTimestamp(date: Date) {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isFriscoProperty(property: Pick<PropertyRow, 'city' | 'raw'>) {
  if (property.city?.toLowerCase().includes('frisco')) {
    return true;
  }

  const address =
    typeof property.raw.address === 'string'
      ? property.raw.address
      : typeof property.raw.fullAddress === 'string'
        ? property.raw.fullAddress
        : null;

  return address?.toLowerCase().includes('frisco') ?? false;
}

function getSourceFailures(metadata: unknown): SourceFailure[] {
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    !('sourceFailures' in metadata) ||
    !Array.isArray((metadata as { sourceFailures?: unknown[] }).sourceFailures)
  ) {
    return [];
  }

  return (metadata as { sourceFailures: unknown[] }).sourceFailures.flatMap((item) => {
    if (
      item &&
      typeof item === 'object' &&
      'sourceId' in item &&
      'sourceUrl' in item &&
      'message' in item &&
      typeof item.sourceId === 'string' &&
      typeof item.sourceUrl === 'string' &&
      typeof item.message === 'string'
    ) {
      return [
        {
          sourceId: item.sourceId,
          sourceUrl: item.sourceUrl,
          message: item.message,
        },
      ];
    }

    return [];
  });
}

function getStatusCounts(rows: Array<{ status: string; count: number }>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.status, Number(row.count));
  }

  return counts;
}

export default async function SeoDraftsPage() {
  const authContext = await getAuthContext();
  if (!authContext) {
    return null;
  }

  const [propertyRows, countRows, draftRows] = await Promise.all([
    db
      .select({
        id: properties.id,
        name: properties.name,
        city: properties.city,
        address: properties.address,
        raw: properties.raw,
      })
      .from(propertyAccess)
      .innerJoin(properties, eq(propertyAccess.propertyId, properties.id))
      .where(eq(propertyAccess.organizationId, authContext.orgId))
      .orderBy(asc(properties.name)),
    db
      .select({
        status: seoDrafts.status,
        count: sql<number>`count(*)`,
      })
      .from(seoDrafts)
      .where(
        and(
          eq(seoDrafts.organizationId, authContext.orgId),
          eq(seoDrafts.marketKey, MARKET_KEY),
          eq(seoDrafts.siteKey, SITE_KEY),
        ),
      )
      .groupBy(seoDrafts.status),
    db
      .select({
        id: seoDrafts.id,
        status: seoDrafts.status,
        titleTag: seoDrafts.titleTag,
        slug: seoDrafts.slug,
        generatedAt: seoDrafts.generatedAt,
        updatedAt: seoDrafts.updatedAt,
        reviewNotes: seoDrafts.reviewNotes,
        sourceUrls: seoDrafts.sourceUrls,
        targetKeyword: seoOpportunities.targetKeyword,
        score: seoOpportunities.score,
        eventTitle: seoEventCandidates.title,
        sourceUrl: seoEventCandidates.sourceUrl,
        runStatus: seoPipelineRuns.status,
        runMetadata: seoPipelineRuns.metadata,
      })
      .from(seoDrafts)
      .innerJoin(seoOpportunities, eq(seoDrafts.opportunityId, seoOpportunities.id))
      .innerJoin(seoEventCandidates, eq(seoOpportunities.candidateId, seoEventCandidates.id))
      .innerJoin(seoPipelineRuns, eq(seoEventCandidates.runId, seoPipelineRuns.id))
      .where(
        and(
          eq(seoDrafts.organizationId, authContext.orgId),
          eq(seoDrafts.marketKey, MARKET_KEY),
          eq(seoDrafts.siteKey, SITE_KEY),
        ),
      )
      .orderBy(desc(seoDrafts.updatedAt))
      .limit(25),
  ]);

  const friscoProperties = Array.from(
    new Map(
      propertyRows.map((row) => [
        row.id,
        {
          id: row.id,
          name: row.name,
          city: row.city ?? null,
          address: row.address ?? null,
          raw: (row.raw ?? {}) as Record<string, unknown>,
        },
      ]),
    ).values(),
  ).filter(isFriscoProperty);
  const drafts: DraftRow[] = draftRows.map((row) => ({
    ...row,
    reviewNotes: row.reviewNotes ?? [],
    sourceUrls: Array.from(new Set([...(row.sourceUrls ?? []), row.sourceUrl])),
  }));
  const canManageDrafts = hasPermission(authContext.role, 'seo.update');
  const counts = getStatusCounts(countRows);
  const totalDrafts = countRows.reduce((sum, row) => sum + Number(row.count), 0);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">SEO Drafts</h1>
          {totalDrafts > 0 ? (
            <p className="text-sm text-gray-500 mt-1">
              {totalDrafts} draft{totalDrafts !== 1 ? 's' : ''} across {friscoProperties.length}{' '}
              Frisco propert{friscoProperties.length !== 1 ? 'ies' : 'y'}
            </p>
          ) : (
            <p className="text-sm text-gray-500 mt-1">
              Generate Frisco event pages for StayInFrisco and review them here before publishing.
            </p>
          )}
        </div>
        {canManageDrafts ? (
          <RunSeoDraftsButton />
        ) : (
          <p className="text-sm text-gray-500">Read-only access</p>
        )}
      </div>

      {friscoProperties.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <SyncPropertiesButton />
        </div>
      ) : totalDrafts === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          No SEO drafts yet. Click &quot;Run Frisco SEO Drafts&quot; to create the first review queue.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {([
              ['needs_review', 'Needs Review'],
              ['needs_attention', 'Needs Attention'],
              ['approved', 'Approved'],
              ['rejected', 'Rejected'],
              ['generated', 'Generated'],
            ] as [string, string][]).map(([status, label]) => (
              <div key={status} className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">
                  {counts.get(status) ?? 0}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {drafts.map((draft: DraftRow) => {
              const sourceFailures = getSourceFailures(draft.runMetadata);
              return (
                <div
                  key={draft.id}
                  className="rounded-lg border border-gray-200 bg-white p-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                        {draft.status.replace(/_/g, ' ')}
                      </span>
                      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        Score {draft.score}
                      </span>
                      {draft.runStatus === 'partial' ? (
                        <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                          Source coverage partial
                        </span>
                      ) : null}
                    </div>

                    <h2 className="text-lg font-semibold text-gray-900">{draft.titleTag}</h2>
                    <p className="text-sm text-gray-500 mt-1">{draft.targetKeyword}</p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded border border-gray-200 bg-gray-50 p-3">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Event
                        </p>
                        <p className="text-sm text-gray-900 mt-1">{draft.eventTitle}</p>
                      </div>
                      <div className="rounded border border-gray-200 bg-gray-50 p-3">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Draft URL
                        </p>
                        <p className="text-sm text-gray-900 mt-1 break-all">/{draft.slug}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Source Links
                        </p>
                        <ul className="mt-1 space-y-1">
                          {draft.sourceUrls.map((sourceUrl) => (
                            <li key={`${draft.id}-${sourceUrl}`}>
                              <a
                                href={sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-blue-700 hover:text-blue-900 break-all"
                              >
                                {sourceUrl}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Timeline
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          Generated {formatTimestamp(draft.generatedAt)} · Updated{' '}
                          {formatTimestamp(draft.updatedAt)}
                        </p>
                      </div>
                    </div>

                    {draft.reviewNotes.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                          Review Notes
                        </p>
                        <ul className="space-y-2">
                          {draft.reviewNotes.map((note, index) => (
                            <li
                              key={`${draft.id}-note-${index}`}
                              className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                            >
                              {note}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {sourceFailures.length > 0 ? (
                      <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-medium text-amber-700 uppercase tracking-wider mb-2">
                          Source Failures
                        </p>
                        <ul className="space-y-2 text-sm text-amber-900">
                          {sourceFailures.map((failure) => (
                            <li key={`${draft.id}-${failure.sourceId}`}>
                              <span className="font-medium">{failure.sourceId}</span>: {failure.message}{' '}
                              <a
                                href={failure.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="underline underline-offset-2"
                              >
                                view source
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  {canManageDrafts ? (
                    <DraftReviewActions draftId={draft.id} currentStatus={draft.status} />
                  ) : (
                    <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                      Review actions require draft write access.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
