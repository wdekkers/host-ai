import { createHash, randomUUID } from 'node:crypto';

import OpenAI from 'openai';

import { friscoEventSources } from './event-sources';
import { htmlToText } from './html-to-text';

import type { SeoEventSource } from './event-sources';

export type ScoutedEventCandidate = {
  id: string;
  sourceId: string;
  sourceUrl: string;
  sourceDomain: string;
  title: string;
  venueName: string | null;
  city: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  summary: string | null;
  sourceSnippet: string | null;
  normalizedHash: string;
  raw: Record<string, unknown>;
};

export type ScoutSourceFailure = {
  sourceId: string;
  sourceUrl: string;
  message: string;
};

export type ScoutEventsResult = {
  candidates: ScoutedEventCandidate[];
  sourceFailures: ScoutSourceFailure[];
  partial: boolean;
};

type ExtractedEvent = {
  title: string;
  venueName?: string | null;
  city?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  summary?: string | null;
};

type Extractor = (args: {
  sourceId: string;
  sourceUrl: string;
  text: string;
}) => Promise<ExtractedEvent[]>;

type ScoutEventsDependencies = {
  fetchImpl?: typeof fetch;
  extractor?: Extractor;
  sources?: SeoEventSource[];
};

const extractionPrompt = `Extract upcoming public events from the provided source text.
Return valid JSON only in the format:
{"events":[{"title":string,"venueName":string|null,"city":string|null,"startsAt":string|null,"endsAt":string|null,"summary":string|null}]}
Only include events that clearly appear in the text. Do not invent dates or venues.`;

function normalizeDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function buildSourceSnippet(text: string, title: string): string | null {
  const lowerText = text.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const index = lowerText.indexOf(lowerTitle);

  if (index === -1) {
    return text.slice(0, 280) || null;
  }

  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + title.length + 160);
  return text.slice(start, end).trim() || null;
}

function normalizedHashForEvent(event: {
  title: string;
  venueName: string | null;
  city: string | null;
  startsAt: Date | null;
}): string {
  const key = [
    event.title.trim().toLowerCase(),
    event.venueName?.trim().toLowerCase() ?? '',
    event.city?.trim().toLowerCase() ?? '',
    event.startsAt?.toISOString().slice(0, 10) ?? '',
  ].join('|');

  return createHash('sha1').update(key).digest('hex');
}

async function defaultExtractor({
  sourceId,
  sourceUrl,
  text,
}: {
  sourceId: string;
  sourceUrl: string;
  text: string;
}): Promise<ExtractedEvent[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for SEO event scouting');
  }

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: extractionPrompt,
      },
      {
        role: 'user',
        content: `Source ID: ${sourceId}
Source URL: ${sourceUrl}
Text:
${text.slice(0, 12000)}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return [];
  }

  const parsed = JSON.parse(content) as { events?: ExtractedEvent[] };
  return Array.isArray(parsed.events) ? parsed.events : [];
}

export async function scoutEvents({
  fetchImpl = fetch,
  extractor = defaultExtractor,
  sources = friscoEventSources,
}: ScoutEventsDependencies = {}): Promise<ScoutEventsResult> {
  const candidates: ScoutedEventCandidate[] = [];
  const sourceFailures: ScoutSourceFailure[] = [];

  for (const source of sources) {
    try {
      const response = await fetchImpl(source.url, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        sourceFailures.push({
          sourceId: source.id,
          sourceUrl: source.url,
          message: `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`,
        });
        continue;
      }

      const html = await response.text();
      const text = htmlToText(html);
      if (!text) {
        continue;
      }

      const extractedEvents = await extractor({
        sourceId: source.id,
        sourceUrl: source.url,
        text,
      });

      for (const event of extractedEvents) {
        if (!event.title?.trim()) {
          continue;
        }

        const startsAt = normalizeDate(event.startsAt);
        const endsAt = normalizeDate(event.endsAt);
        const venueName = event.venueName?.trim() || null;
        const city = event.city?.trim() || source.city;
        const summary = event.summary?.trim() || null;
        const normalizedHash = normalizedHashForEvent({
          title: event.title,
          venueName,
          city,
          startsAt,
        });

        candidates.push({
          id: randomUUID(),
          sourceId: source.id,
          sourceUrl: source.url,
          sourceDomain: new URL(source.url).hostname,
          title: event.title.trim(),
          venueName,
          city,
          startsAt,
          endsAt,
          summary,
          sourceSnippet: buildSourceSnippet(text, event.title),
          normalizedHash,
          raw: {
            sourceLabel: source.label,
            extracted: event,
          },
        });
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'OPENAI_API_KEY is required for SEO event scouting'
      ) {
        throw error;
      }

      sourceFailures.push({
        sourceId: source.id,
        sourceUrl: source.url,
        message: error instanceof Error ? error.message : 'Unknown source failure',
      });
    }
  }

  return {
    candidates,
    sourceFailures,
    partial: sourceFailures.length > 0,
  };
}
