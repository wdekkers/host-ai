'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { KnowledgeChannel, KnowledgeEntry, KnowledgeStatus } from '@walt/contracts';

type ManagedKnowledgeScope = 'global' | 'property';
type VisibleEntryType = 'faq' | 'guidebook';

type KnowledgeManagerProps = {
  scope: ManagedKnowledgeScope;
  propertyId?: string;
  propertyName?: string;
};

type KnowledgeFormState = {
  topicKey: string;
  title: string;
  question: string;
  answer: string;
  body: string;
  channels: KnowledgeChannel[];
  status: KnowledgeStatus;
  sortOrder: string;
  slug: string;
};

const entryTypes: VisibleEntryType[] = ['faq', 'guidebook'];
const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400';

const channelLabels: Record<KnowledgeChannel, string> = {
  ai: 'AI',
  website: 'Website',
  guidebook: 'Guidebook',
};

const statusStyles: Record<KnowledgeStatus, string> = {
  draft: 'bg-amber-50 text-amber-700',
  published: 'bg-green-50 text-green-700',
  archived: 'bg-gray-100 text-gray-600',
};

const defaultChannelsByType: Record<VisibleEntryType, KnowledgeChannel[]> = {
  faq: ['ai', 'website'],
  guidebook: ['ai', 'guidebook'],
};

function emptyForm(entryType: VisibleEntryType): KnowledgeFormState {
  return {
    topicKey: '',
    title: '',
    question: '',
    answer: '',
    body: '',
    channels: [...defaultChannelsByType[entryType]],
    status: 'draft',
    sortOrder: '0',
    slug: '',
  };
}

function buildForm(entry: KnowledgeEntry): KnowledgeFormState {
  return {
    topicKey: entry.topicKey,
    title: entry.title ?? '',
    question: entry.question ?? '',
    answer: entry.answer ?? '',
    body: entry.body ?? '',
    channels: [...entry.channels],
    status: entry.status,
    sortOrder: String(entry.sortOrder),
    slug: entry.slug ?? '',
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function deriveTopicKey(entryType: VisibleEntryType, form: KnowledgeFormState) {
  const base = form.topicKey.trim() || (entryType === 'faq' ? form.question : form.title);
  return slugify(base);
}

function summarizeEntry(entry: KnowledgeEntry) {
  if (entry.entryType === 'faq') {
    return entry.answer ?? '';
  }

  return entry.body ?? '';
}

function buildManagedListUrl(scope: ManagedKnowledgeScope, entryType: VisibleEntryType, propertyId?: string) {
  if (scope === 'global') {
    return `/api/knowledge?scope=global&entryType=${entryType}`;
  }

  return `/api/properties/${propertyId}/knowledge?includeInherited=false&entryType=${entryType}`;
}

function buildInheritedListUrl(entryType: VisibleEntryType) {
  return `/api/knowledge?scope=global&entryType=${entryType}`;
}

export function KnowledgeManager({ scope, propertyId, propertyName }: KnowledgeManagerProps) {
  const [activeType, setActiveType] = useState<VisibleEntryType>('faq');
  const [items, setItems] = useState<KnowledgeEntry[]>([]);
  const [inheritedItems, setInheritedItems] = useState<KnowledgeEntry[]>([]);
  const [form, setForm] = useState<KnowledgeFormState>(() => emptyForm('faq'));
  const [faqNotes, setFaqNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isGeneratingFaq, setIsGeneratingFaq] = useState(false);
  const activeTypeRef = useRef<VisibleEntryType>(activeType);

  useEffect(() => {
    activeTypeRef.current = activeType;
  }, [activeType]);

  async function reloadEntries(entryType: VisibleEntryType) {
    const managedResponse = await fetch(buildManagedListUrl(scope, entryType, propertyId), {
      cache: 'no-store',
    });
    const managedPayload = (await managedResponse.json()) as {
      items?: KnowledgeEntry[];
      error?: string;
    };

    if (!managedResponse.ok) {
      throw new Error(managedPayload.error ?? 'Unable to load knowledge entries.');
    }

    if (activeTypeRef.current !== entryType) {
      return;
    }

    setItems(managedPayload.items ?? []);

    if (scope === 'property') {
      const inheritedResponse = await fetch(buildInheritedListUrl(entryType), { cache: 'no-store' });
      const inheritedPayload = (await inheritedResponse.json()) as {
        items?: KnowledgeEntry[];
        error?: string;
      };

      if (!inheritedResponse.ok) {
        throw new Error(inheritedPayload.error ?? 'Unable to load inherited global knowledge.');
      }

      if (activeTypeRef.current !== entryType) {
        return;
      }

      setInheritedItems(inheritedPayload.items ?? []);
      return;
    }

    setInheritedItems([]);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadEntries() {
      setLoading(true);
      setLoadError(null);

      try {
        const requests = [fetch(buildManagedListUrl(scope, activeType, propertyId), { cache: 'no-store' })];

        if (scope === 'property') {
          requests.push(fetch(buildInheritedListUrl(activeType), { cache: 'no-store' }));
        }

        const responses = await Promise.all(requests);
        const managedResponse = responses[0];
        const inheritedResponse = responses[1];

        if (!managedResponse) {
          throw new Error('Unable to load knowledge entries.');
        }

        const managedPayload = (await managedResponse.json()) as {
          items?: KnowledgeEntry[];
          error?: string;
        };

        if (!managedResponse.ok) {
          throw new Error(managedPayload.error ?? 'Unable to load knowledge entries.');
        }

        if (!isMounted) {
          return;
        }

        if (activeTypeRef.current !== activeType) {
          return;
        }

        setItems(managedPayload.items ?? []);

        if (scope === 'property' && inheritedResponse) {
          const inheritedPayload = (await inheritedResponse.json()) as {
            items?: KnowledgeEntry[];
            error?: string;
          };

          if (!inheritedResponse.ok) {
            throw new Error(inheritedPayload.error ?? 'Unable to load inherited global knowledge.');
          }

          if (!isMounted) {
            return;
          }

          if (activeTypeRef.current !== activeType) {
            return;
          }

          setInheritedItems(inheritedPayload.items ?? []);
        } else if (scope === 'global') {
          setInheritedItems([]);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : 'Unable to load knowledge entries.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadEntries();

    return () => {
      isMounted = false;
    };
  }, [activeType, propertyId, scope]);

  const overriddenTopics = useMemo(() => new Set(items.map((entry) => entry.topicKey)), [items]);
  const visibleInheritedItems = useMemo(
    () => inheritedItems.filter((entry) => !overriddenTopics.has(entry.topicKey)),
    [inheritedItems, overriddenTopics],
  );

  function updateField<Key extends keyof KnowledgeFormState>(key: Key, value: KnowledgeFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSubmitError(null);
    setSuccess(null);
  }

  function toggleChannel(channel: KnowledgeChannel) {
    setForm((current) => {
      const hasChannel = current.channels.includes(channel);
      const nextChannels = hasChannel
        ? current.channels.filter((value) => value !== channel)
        : [...current.channels, channel];

      return { ...current, channels: nextChannels };
    });
    setSubmitError(null);
    setSuccess(null);
  }

  function resetForm(entryType: VisibleEntryType = activeType) {
    setEditingId(null);
    setForm(emptyForm(entryType));
    setSubmitError(null);
    setSuccess(null);
  }

  function handleTabChange(entryType: VisibleEntryType) {
    setActiveType(entryType);
    resetForm(entryType);
  }

  function editEntry(entry: KnowledgeEntry) {
    const entryType = entry.entryType as VisibleEntryType;
    setActiveType(entryType);
    setEditingId(entry.id);
    setForm(buildForm(entry));
    setSubmitError(null);
    setSuccess(null);
  }

  function buildRequestBody(entryType: VisibleEntryType) {
    const topicKey = deriveTopicKey(entryType, form);
    if (!topicKey) {
      throw new Error('Add a question or title so a topic key can be generated.');
    }

    if (form.channels.length === 0) {
      throw new Error('Select at least one channel.');
    }

    return {
      entryType,
      topicKey,
      title: form.title.trim() || undefined,
      question: form.question.trim() || undefined,
      answer: form.answer.trim() || undefined,
      body: form.body.trim() || undefined,
      channels: form.channels,
      status: form.status,
      sortOrder: Number.parseInt(form.sortOrder || '0', 10) || 0,
      slug: form.slug.trim() || null,
    };
  }

  async function generateFaqDraft() {
    if (!faqNotes.trim()) {
      setSubmitError('Add rough FAQ notes first.');
      setSuccess(null);
      return;
    }

    setIsGeneratingFaq(true);
    setSubmitError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/knowledge/faq-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: faqNotes,
          propertyName,
        }),
      });

      const payload = (await response.json()) as {
        draft?: { question: string; answer: string; topicKey: string };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to generate FAQ draft.');
      }

      if (!payload.draft) {
        throw new Error('AI did not return a FAQ draft.');
      }

      setForm((current) => ({
        ...current,
        question: payload.draft?.question ?? current.question,
        answer: payload.draft?.answer ?? current.answer,
        topicKey: payload.draft?.topicKey ?? current.topicKey,
        slug: current.slug || payload.draft?.topicKey || current.slug,
      }));
      setSuccess('FAQ draft generated. Review it before saving.');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to generate FAQ draft.');
    } finally {
      setIsGeneratingFaq(false);
    }
  }

  function saveEntry() {
    startTransition(async () => {
      try {
        const body = buildRequestBody(activeType);
        const url =
          editingId == null
            ? scope === 'global'
              ? '/api/knowledge'
              : `/api/properties/${propertyId}/knowledge`
            : scope === 'global'
              ? `/api/knowledge/${editingId}`
              : `/api/properties/${propertyId}/knowledge/${editingId}`;

        const method = editingId == null ? 'POST' : 'PATCH';
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const payload = (await response.json()) as {
          item?: KnowledgeEntry;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? 'Unable to save knowledge entry.');
        }

        resetForm(activeType);
        setSuccess(editingId == null ? 'Knowledge entry created.' : 'Knowledge entry updated.');
        await reloadEntries(activeType);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Unable to save knowledge entry.');
      }
    });
  }

  function overrideEntry(entryId: string) {
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/properties/${propertyId}/knowledge/${entryId}/override`,
          { method: 'POST' },
        );
        const payload = (await response.json()) as { item?: KnowledgeEntry; error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? 'Unable to create property override.');
        }

        const item = payload.item;
        if (item) {
          setActiveType(item.entryType as VisibleEntryType);
          setEditingId(item.id);
          setForm(buildForm(item));
        }

        await reloadEntries((item?.entryType as VisibleEntryType | undefined) ?? activeType);
        setSuccess('Property override created as a draft.');
        setSubmitError(null);
      } catch (error) {
        setSubmitError(
          error instanceof Error ? error.message : 'Unable to create property override.',
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              {scope === 'global' ? 'Global Knowledge' : 'Property Knowledge'}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {scope === 'global'
                ? 'Manage shared FAQ and guidebook content for the AI, website, and digital guidebook.'
                : 'Manage listing-specific FAQ and guidebook content. Property entries override global entries with the same topic key.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {entryTypes.map((entryType) => (
              <button
                key={entryType}
                type="button"
                onClick={() => handleTabChange(entryType)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  activeType === entryType
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                }`}
              >
                {entryType === 'faq' ? 'FAQ' : 'Guidebook'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {activeType === 'faq' ? (
            <>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 md:col-span-2">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-800">
                      Quick FAQ Draft
                    </h3>
                    <p className="mt-1 text-xs text-blue-700">
                      Dictate rough notes and AI will turn them into a clean FAQ draft you can
                      edit before saving.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void generateFaqDraft()}
                    disabled={isGeneratingFaq}
                    className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-50"
                  >
                    {isGeneratingFaq ? 'Generating…' : 'Generate FAQ'}
                  </button>
                </div>

                <textarea
                  className={`${inputClass} min-h-28 border-blue-200 bg-white`}
                  value={faqNotes}
                  onChange={(event) => setFaqNotes(event.target.value)}
                  placeholder="Guests keep asking about parking. They should use garage spot 2. Overflow parking is okay after 6pm. No street parking on Fridays because of cleaning."
                />
              </div>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">Question</span>
                <input
                  className={`${inputClass} mt-1`}
                  value={form.question}
                  onChange={(event) => updateField('question', event.target.value)}
                  placeholder="Where do guests park?"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-gray-700">Answer</span>
                <textarea
                  className={`${inputClass} mt-1 min-h-32`}
                  value={form.answer}
                  onChange={(event) => updateField('answer', event.target.value)}
                  placeholder="Guests should use garage spot 2 and the overflow driveway."
                />
              </label>
            </>
          ) : (
            <>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Title</span>
                <input
                  className={`${inputClass} mt-1`}
                  value={form.title}
                  onChange={(event) => updateField('title', event.target.value)}
                  placeholder="Pool heating"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-gray-700">Body</span>
                <textarea
                  className={`${inputClass} mt-1 min-h-40`}
                  value={form.body}
                  onChange={(event) => updateField('body', event.target.value)}
                  placeholder="Pool heating must be requested 24 hours in advance."
                />
              </label>
            </>
          )}

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Topic key</span>
            <input
              className={`${inputClass} mt-1`}
              value={form.topicKey}
              onChange={(event) => updateField('topicKey', event.target.value)}
              placeholder="parking"
              disabled={editingId != null}
            />
            <p className="mt-1 text-xs text-gray-500">
              {editingId
                ? 'Topic keys stay fixed after creation because property overrides are matched by this key.'
                : 'Used for overrides. Leave blank to auto-generate from the question or title.'}
            </p>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Slug</span>
            <input
              className={`${inputClass} mt-1`}
              value={form.slug}
              onChange={(event) => updateField('slug', event.target.value)}
              placeholder="parking"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Status</span>
            <select
              className={`${inputClass} mt-1`}
              value={form.status}
              onChange={(event) => updateField('status', event.target.value as KnowledgeStatus)}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Sort order</span>
            <input
              type="number"
              className={`${inputClass} mt-1`}
              value={form.sortOrder}
              onChange={(event) => updateField('sortOrder', event.target.value)}
            />
          </label>

          <div className="md:col-span-2">
            <span className="text-sm font-medium text-gray-700">Channels</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(channelLabels) as KnowledgeChannel[]).map((channel) => {
                const checked = form.channels.includes(channel);

                return (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => toggleChannel(channel)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      checked
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {channelLabels[channel]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {(submitError || success) && (
          <div
            className={`mt-4 rounded-md px-4 py-3 text-sm ${
              submitError
                ? 'border border-red-200 bg-red-50 text-red-700'
                : 'border border-green-200 bg-green-50 text-green-700'
            }`}
          >
            {submitError ?? success}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => resetForm()}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {editingId ? 'Cancel edit' : 'Clear form'}
          </button>
          <button
            type="button"
            onClick={saveEntry}
            disabled={isPending}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
          >
            {isPending ? 'Saving…' : editingId ? 'Update entry' : 'Create entry'}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Loading knowledge entries…
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                {scope === 'global' ? 'Managed Entries' : 'Property Entries'}
              </h3>
              <span className="text-xs text-gray-500">
                {items.length} {items.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-gray-500">
                No {activeType === 'faq' ? 'FAQ' : 'guidebook'} entries yet.
              </p>
            ) : (
              <div className="space-y-3">
                {items.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">
                          {entry.entryType === 'faq' ? entry.question : entry.title}
                        </h4>
                        <p className="mt-1 text-xs text-gray-500">Topic key: {entry.topicKey}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[entry.status]}`}
                        >
                          {entry.status}
                        </span>
                        {entry.channels.map((channel) => (
                          <span
                            key={channel}
                            className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                          >
                            {channelLabels[channel]}
                          </span>
                        ))}
                      </div>
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                      {summarizeEntry(entry)}
                    </p>

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => editEntry(entry)}
                        className="text-sm font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {scope === 'property' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-800">
                    Inherited Global Entries
                  </h3>
                  <p className="mt-1 text-xs text-blue-700">
                    Property entries with the same topic key replace these global entries.
                  </p>
                </div>
                <span className="text-xs text-blue-700">
                  {visibleInheritedItems.length} {visibleInheritedItems.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>

              {visibleInheritedItems.length === 0 ? (
                <p className="text-sm text-blue-700">
                  No inherited {activeType === 'faq' ? 'FAQ' : 'guidebook'} entries remain for this
                  property.
                </p>
              ) : (
                <div className="space-y-3">
                  {visibleInheritedItems.map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-blue-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">
                            {entry.entryType === 'faq' ? entry.question : entry.title}
                          </h4>
                          <p className="mt-1 text-xs text-gray-500">Topic key: {entry.topicKey}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {entry.channels.map((channel) => (
                            <span
                              key={channel}
                              className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700"
                            >
                              {channelLabels[channel]}
                            </span>
                          ))}
                        </div>
                      </div>

                      <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                        {summarizeEntry(entry)}
                      </p>

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => overrideEntry(entry.id)}
                          disabled={isPending}
                          className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-50"
                        >
                          Override for this property
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
