export type MatchConfidence = 'manual' | 'auto-high' | 'auto-low';

const US_STATE_SUFFIX = /[,–-]\s*[A-Z]{2}(\s|$)/;
const CITY_STATE_SUFFIX_FULL = /[–-]\s*[A-Z][a-zA-Z]+,\s*[A-Z]{2}\s*$/;
const CITY_DASH_SUFFIX = /[–-]\s*[A-Z][a-zA-Z ]+$/;
const PUNCT = /[!?.,;:&|]+/g;

export function normalizeName(name: string): string {
  let s = name.trim();
  s = s.replace(CITY_STATE_SUFFIX_FULL, '');
  s = s.replace(CITY_DASH_SUFFIX, '');
  s = s.replace(US_STATE_SUFFIX, '');
  s = s.toLowerCase();
  s = s.replace(PUNCT, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  // Use Uint32Array so index access is always `number` (never `undefined`)
  // under `noUncheckedIndexedAccess`.
  const v0 = new Uint32Array(b.length + 1);
  const v1 = new Uint32Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) v0[j] = j;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    const ac = a.charCodeAt(i);
    for (let j = 0; j < b.length; j++) {
      const cost = ac === b.charCodeAt(j) ? 0 : 1;
      v1[j + 1] = Math.min(v1[j]! + 1, v0[j + 1]! + 1, v0[j]! + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j]!;
  }
  return v1[b.length]!;
}

function classify(distance: number, a: string, b: string): MatchConfidence | null {
  // Prefix / containment is a strong signal: "Dreamscape" vs "Dreamscape Retreat"
  // should be high-confidence even though edit distance is large.
  if (a.length > 0 && b.length > 0) {
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    if (longer.startsWith(shorter + ' ') || longer.endsWith(' ' + shorter)) {
      return 'auto-high';
    }
  }
  if (distance <= 3) return 'auto-high';
  if (distance <= 8) return 'auto-low';
  return null;
}

export interface InternalProperty {
  id: string;
  name: string;
}

export interface PriceLabsListingLite {
  id: string;
  name: string;
}

export interface MatchResult {
  pricelabsListingId: string;
  pricelabsListingName: string;
  propertyId: string | null;
  confidence: MatchConfidence | null;
}

export function autoMatchListings(
  listings: PriceLabsListingLite[],
  properties: InternalProperty[],
): MatchResult[] {
  // Build all candidate pairs with distances.
  const pairs: {
    listingId: string;
    propertyId: string;
    distance: number;
    normL: string;
    normP: string;
  }[] = [];
  for (const l of listings) {
    const normL = normalizeName(l.name);
    for (const p of properties) {
      const normP = normalizeName(p.name);
      pairs.push({
        listingId: l.id,
        propertyId: p.id,
        distance: levenshtein(normL, normP),
        normL,
        normP,
      });
    }
  }
  // Greedy: pick best (smallest distance) pair first, mark both consumed.
  pairs.sort((a, b) => a.distance - b.distance);
  const usedListings = new Set<string>();
  const usedProperties = new Set<string>();
  const matched = new Map<
    string,
    { propertyId: string; distance: number; normL: string; normP: string }
  >();
  for (const pair of pairs) {
    if (usedListings.has(pair.listingId) || usedProperties.has(pair.propertyId)) continue;
    if (classify(pair.distance, pair.normL, pair.normP) === null) continue;
    matched.set(pair.listingId, {
      propertyId: pair.propertyId,
      distance: pair.distance,
      normL: pair.normL,
      normP: pair.normP,
    });
    usedListings.add(pair.listingId);
    usedProperties.add(pair.propertyId);
  }
  // Emit one row per listing.
  return listings.map((l) => {
    const m = matched.get(l.id);
    return {
      pricelabsListingId: l.id,
      pricelabsListingName: l.name,
      propertyId: m?.propertyId ?? null,
      confidence: m ? classify(m.distance, m.normL, m.normP) : null,
    };
  });
}
