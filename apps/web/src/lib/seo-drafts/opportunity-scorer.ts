import type { FriscoPropertyContext } from './property-context';
import type { ScoutedEventCandidate } from './event-scout';

type ScoreCandidateArgs = Pick<
  ScoutedEventCandidate,
  'title' | 'city' | 'startsAt' | 'summary' | 'venueName' | 'sourceUrl'
> & {
  now?: Date;
  propertyIds?: string[];
};

export type ScoredOpportunity = {
  score: number;
  reasons: string[];
  travelerIntent: string;
  targetKeyword: string;
  targetSlug: string;
  propertyIds: string[];
};

export type RankedDraftCandidate = {
  candidate: ScoutedEventCandidate;
  scored: ScoredOpportunity;
};

export const MINIMUM_OPPORTUNITY_SCORE = 45;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function daysUntil(date: Date, now: Date): number {
  return Math.round((date.valueOf() - now.valueOf()) / (24 * 60 * 60 * 1000));
}

function looksTravelRelevant(text: string): boolean {
  return /(game|concert|festival|weekend|family|show|tournament|event|match|rodeo|expo)/i.test(
    text,
  );
}

function looksProminentVenue(venueName: string | null): boolean {
  return /(riders field|toyota stadium|the star|ford center|comerica center)/i.test(
    venueName ?? '',
  );
}

export function scoreCandidate({
  title,
  city,
  startsAt,
  summary,
  venueName,
  sourceUrl,
  now = new Date(),
  propertyIds = [],
}: ScoreCandidateArgs): ScoredOpportunity {
  let score = 0;
  const reasons: string[] = [];
  const combinedText = `${title} ${summary ?? ''}`.trim();

  if (city?.toLowerCase().includes('frisco')) {
    score += 30;
    reasons.push('Frisco-local event');
  } else if (city?.toLowerCase().includes('texas')) {
    score += 5;
    reasons.push('Texas event with weaker market fit');
  } else {
    score -= 15;
    reasons.push('Outside primary Frisco market');
  }

  if (startsAt) {
    const deltaDays = daysUntil(startsAt, now);
    if (deltaDays < 0) {
      score -= 40;
      reasons.push('Event date is stale');
    } else if (deltaDays <= 14) {
      score += 30;
      reasons.push('Near-term demand window');
    } else if (deltaDays <= 45) {
      score += 18;
      reasons.push('Upcoming event with planning runway');
    } else {
      score += 4;
      reasons.push('Event is farther out');
    }
  } else {
    score -= 8;
    reasons.push('Missing clear event date');
  }

  if (looksTravelRelevant(combinedText)) {
    score += 15;
    reasons.push('Travel-relevant event theme');
  } else {
    score -= 8;
    reasons.push('Low travel relevance');
  }

  if (looksProminentVenue(venueName)) {
    score += 10;
    reasons.push('Prominent Frisco venue');
  }

  if ((summary ?? '').trim().length >= 30) {
    score += 6;
    reasons.push('Usable source description');
  } else {
    score -= 6;
    reasons.push('Thin source description');
  }

  if (sourceUrl.toLowerCase().includes('frisco')) {
    score += 4;
    reasons.push('Frisco-oriented source');
  }

  if (propertyIds.length > 0) {
    score += 5;
    reasons.push('Maps to existing Frisco inventory');
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  const targetKeyword = `places to stay near ${title} in Frisco TX`;
  const targetSlug = slugify(`${title}-frisco-tx`);

  return {
    score: boundedScore,
    reasons,
    travelerIntent: looksTravelRelevant(combinedText)
      ? 'event-driven leisure travel'
      : 'local trip planning',
    targetKeyword,
    targetSlug,
    propertyIds,
  };
}

export function scoreEventForProperties(
  candidate: ScoutedEventCandidate,
  properties: FriscoPropertyContext[],
  now = new Date(),
): ScoredOpportunity {
  return scoreCandidate({
    title: candidate.title,
    city: candidate.city,
    startsAt: candidate.startsAt,
    summary: candidate.summary,
    venueName: candidate.venueName,
    sourceUrl: candidate.sourceUrl,
    now,
    propertyIds: properties.map((property) => property.id),
  });
}

export function shouldDraftOpportunity(opportunity: ScoredOpportunity): boolean {
  return opportunity.score >= MINIMUM_OPPORTUNITY_SCORE;
}

export function rankCandidatesForDrafting(
  candidates: ScoutedEventCandidate[],
  properties: FriscoPropertyContext[],
  maxCandidates: number,
  now = new Date(),
): RankedDraftCandidate[] {
  return candidates
    .map((candidate) => ({
      candidate,
      scored: scoreEventForProperties(candidate, properties, now),
    }))
    .sort((left, right) => right.scored.score - left.scored.score)
    .slice(0, maxCandidates);
}
