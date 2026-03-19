import type {
  KnowledgeChannel,
  KnowledgeEntry,
  KnowledgeStatus,
  KnowledgeScope,
} from '@walt/contracts';

export type KnowledgeEntrySource = {
  listKnowledgeEntries: (args: {
    organizationId: string;
    scope: KnowledgeScope;
    propertyId?: string | null;
    channels?: KnowledgeChannel[];
    status?: KnowledgeStatus;
  }) => Promise<KnowledgeEntry[]>;
};

export type ListKnowledgeEntriesForScopeInput = {
  source: KnowledgeEntrySource;
  organizationId: string;
  scope: KnowledgeScope;
  propertyId?: string | null;
  channels?: KnowledgeChannel[];
  status?: KnowledgeStatus;
};

export type MergeKnowledgeEntriesInput = {
  globalEntries: KnowledgeEntry[];
  propertyEntries: KnowledgeEntry[];
};

export type ResolveKnowledgeForPropertyInput = {
  source: KnowledgeEntrySource;
  organizationId: string;
  propertyId: string | null;
  channels?: KnowledgeChannel[];
  status?: KnowledgeStatus;
  maxEntries?: number;
};

function matchesChannels(entry: KnowledgeEntry, channels?: KnowledgeChannel[]) {
  if (!channels || channels.length === 0) return true;
  return entry.channels.some((channel) => channels.includes(channel));
}

function normalizeEntries(entries: KnowledgeEntry[]) {
  return [...entries].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.topicKey.localeCompare(b.topicKey);
  });
}

export async function listKnowledgeEntriesForScope({
  source,
  organizationId,
  scope,
  propertyId,
  channels,
  status = 'published',
}: ListKnowledgeEntriesForScopeInput): Promise<KnowledgeEntry[]> {
  if (scope === 'property' && !propertyId) {
    throw new Error('propertyId is required when listing property knowledge entries');
  }

  const entries = await source.listKnowledgeEntries({
    organizationId,
    scope,
    propertyId,
    channels,
    status,
  });

  return normalizeEntries(
    entries.filter((entry) => {
      if (entry.scope !== scope) return false;
      if (scope === 'property' && entry.propertyId !== propertyId) return false;
      if (scope === 'global' && entry.propertyId !== null) return false;
      if (entry.status !== status) return false;
      return matchesChannels(entry, channels);
    }),
  );
}

export function mergeKnowledgeEntries({
  globalEntries,
  propertyEntries,
}: MergeKnowledgeEntriesInput): KnowledgeEntry[] {
  const merged = new Map<string, KnowledgeEntry>();

  for (const entry of globalEntries) {
    merged.set(entry.topicKey, entry);
  }

  for (const entry of propertyEntries) {
    merged.set(entry.topicKey, entry);
  }

  return normalizeEntries(Array.from(merged.values()));
}

export async function resolveKnowledgeForProperty({
  source,
  organizationId,
  propertyId,
  channels,
  status = 'published',
  maxEntries = 6,
}: ResolveKnowledgeForPropertyInput): Promise<KnowledgeEntry[]> {
  const [globalEntries, propertyEntries] = await Promise.all([
    listKnowledgeEntriesForScope({
      source,
      organizationId,
      scope: 'global',
      channels,
      status,
    }),
    propertyId
      ? listKnowledgeEntriesForScope({
          source,
          organizationId,
          scope: 'property',
          propertyId,
          channels,
          status,
        })
      : Promise.resolve([]),
  ]);

  const merged = mergeKnowledgeEntries({ globalEntries, propertyEntries });
  return merged.slice(0, Math.max(0, maxEntries));
}

function formatEntry(entry: KnowledgeEntry) {
  const parts: string[] = [`[${entry.topicKey}] ${entry.entryType}`];

  if (entry.title) parts.push(`Title: ${entry.title}`);
  if (entry.question) parts.push(`Question: ${entry.question}`);
  if (entry.answer) parts.push(`Answer: ${entry.answer}`);
  if (entry.body) parts.push(`Body: ${entry.body}`);

  return parts.join('\n');
}

export function formatKnowledgeForPrompt(entries: KnowledgeEntry[]): string {
  if (entries.length === 0) return '';

  return `Managed knowledge:\n${entries.map((entry) => `- ${formatEntry(entry)}`).join('\n\n')}`;
}
