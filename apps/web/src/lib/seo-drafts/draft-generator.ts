import OpenAI from 'openai';

import type { FriscoPropertyContext } from './property-context';
import type { ScoredOpportunity } from './opportunity-scorer';
import type { ScoutedEventCandidate } from './event-scout';

type DraftGeneratorDependencies = {
  aiGenerate?: (args: {
    candidate: ScoutedEventCandidate;
    opportunity: ScoredOpportunity;
    properties: FriscoPropertyContext[];
  }) => Promise<GeneratedDraftShape | null>;
};

export type GeneratedDraftShape = {
  titleTag: string;
  metaDescription: string;
  slug: string;
  h1: string;
  outline: string[];
  bodyMarkdown: string;
  faqItems: Array<{ question: string; answer: string }>;
  ctaText: string;
  internalLinks: Array<{ href: string; anchor: string }>;
  sourceUrls: string[];
};

function defaultSlug(candidate: ScoutedEventCandidate, opportunity: ScoredOpportunity): string {
  return opportunity.targetSlug || candidate.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function fallbackDraft(
  candidate: ScoutedEventCandidate,
  opportunity: ScoredOpportunity,
  properties: FriscoPropertyContext[],
): GeneratedDraftShape {
  const propertyNames = properties.slice(0, 3).map((property) => property.name);
  const propertyLabel =
    propertyNames.length > 0 ? propertyNames.join(', ') : 'our Frisco vacation rentals';
  const intro = `Planning a trip for ${candidate.title} in Frisco, Texas? StayInFrisco helps guests book directly near ${candidate.venueName ?? 'the event venue'} while staying close to restaurants, family attractions, and the major event corridors in Frisco.`;
  const body = `${intro}

## Why stay in Frisco for this event
${candidate.summary ?? `${candidate.title} is the kind of Frisco event that can drive weekend and short-stay travel demand.`} Booking close to the venue cuts drive time and makes arrival, parking, and post-event plans easier.

## Best homes for event weekends
Start with ${propertyLabel}. Each option is positioned for direct booking so guests can compare location, sleeping capacity, and stay details without bouncing back to an OTA.

## Book direct with StayInFrisco
Use the direct booking flow to lock in dates, compare homes, and plan your Frisco trip with fewer fees and clearer property details.`;

  return {
    titleTag: `Where to Stay for ${candidate.title} in Frisco, TX | StayInFrisco`,
    metaDescription: `Book direct with StayInFrisco for ${candidate.title}. Compare Frisco vacation rentals near ${
      candidate.venueName ?? 'top venues'
    } and plan your stay with confidence.`,
    slug: defaultSlug(candidate, opportunity),
    h1: `Where to Stay for ${candidate.title} in Frisco, Texas`,
    outline: [
      `Why ${candidate.title} drives Frisco stays`,
      `Best areas to stay near ${candidate.venueName ?? candidate.title}`,
      'Top direct-booking options',
      'FAQ for event travelers',
    ],
    bodyMarkdown: body,
    faqItems: [
      {
        question: `When should I book for ${candidate.title}?`,
        answer:
          'For popular Frisco event weekends, earlier booking gives you the best mix of location, rate, and home size.',
      },
      {
        question: `Why book direct for ${candidate.title}?`,
        answer:
          'Direct booking gives you clearer stay details, faster support, and an easier comparison across StayInFrisco properties.',
      },
    ],
    ctaText: 'See Frisco homes and book direct',
    internalLinks: [
      { href: '/', anchor: 'StayInFrisco home search' },
      { href: '/properties', anchor: 'Frisco vacation rentals' },
    ],
    sourceUrls: [candidate.sourceUrl],
  };
}

async function defaultAiGenerate({
  candidate,
  opportunity,
  properties,
}: {
  candidate: ScoutedEventCandidate;
  opportunity: ScoredOpportunity;
  properties: FriscoPropertyContext[];
}): Promise<GeneratedDraftShape | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const client = new OpenAI({ apiKey });
  const propertyContext = properties
    .map((property) => `- ${property.name}: ${property.summary}`)
    .join('\n');

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You generate grounded SEO landing page drafts for StayInFrisco.
Use only the provided event facts and property context.
Do not invent venue details, dates, ticketing information, or claims not in the input.
Return valid JSON only with keys: titleTag, metaDescription, slug, h1, outline, bodyMarkdown, faqItems, ctaText, internalLinks, sourceUrls.`,
      },
      {
        role: 'user',
        content: `Event title: ${candidate.title}
Venue: ${candidate.venueName ?? 'unknown'}
City: ${candidate.city ?? 'Frisco'}
Starts at: ${candidate.startsAt?.toISOString() ?? 'unknown'}
Summary: ${candidate.summary ?? 'unknown'}
Source URL: ${candidate.sourceUrl}
Target keyword: ${opportunity.targetKeyword}
Traveler intent: ${opportunity.travelerIntent}
Properties:
${propertyContext}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return null;
  }

  return JSON.parse(content) as GeneratedDraftShape;
}

export async function generateDraft(
  candidate: ScoutedEventCandidate,
  opportunity: ScoredOpportunity,
  properties: FriscoPropertyContext[],
  { aiGenerate = defaultAiGenerate }: DraftGeneratorDependencies = {},
): Promise<GeneratedDraftShape> {
  const aiDraft = await aiGenerate({ candidate, opportunity, properties });
  return aiDraft ?? fallbackDraft(candidate, opportunity, properties);
}
