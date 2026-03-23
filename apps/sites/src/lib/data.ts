import { eq } from 'drizzle-orm';
import {
  createDb,
  properties,
  reviews,
  propertyFaqs,
  seoDrafts,
  seoEventCandidates,
} from '@walt/db';

let _db: ReturnType<typeof createDb> | null = null;
function getDb(): ReturnType<typeof createDb> {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is required');
    _db = createDb(url);
  }
  return _db;
}

// ── Property Data ──

export type PropertyData = {
  name: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sleeps: number | null;
  tagline: string | null;
  description: string | null;
};

export async function getPropertyData(
  siteSlug: string,
  propertyId: string,
): Promise<PropertyData> {
  try {
    const [row] = await getDb()
      .select()
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);
    if (row) {
      return {
        name: row.name ?? '',
        bedrooms: row.bedrooms,
        // bathrooms is stored as text (e.g. "2.5") — parse to number
        bathrooms: row.bathrooms ? parseFloat(row.bathrooms) || null : null,
        sleeps: row.maxGuests,
        tagline: row.summary,
        description: row.description,
      };
    }
  } catch {
    /* DB unavailable, fall through to JSON */
  }
  try {
    const json = await import(`@/data/${siteSlug}/property.json`);
    return json.default ?? json;
  } catch {
    return {
      name: '',
      bedrooms: null,
      bathrooms: null,
      sleeps: null,
      tagline: null,
      description: null,
    };
  }
}

// ── Gallery ──

export type GalleryImage = {
  id: number;
  src: string;
  alt: string;
  category: string;
};

export async function getGalleryData(
  siteSlug: string,
): Promise<GalleryImage[]> {
  try {
    const json = await import(`@/data/${siteSlug}/gallery.json`);
    return json.default ?? json;
  } catch {
    return [];
  }
}

// ── Amenities ──

export type Amenity = {
  id: string;
  label: string;
  detail?: string;
  icon: string;
};

export async function getAmenitiesData(
  siteSlug: string,
): Promise<Amenity[]> {
  try {
    const json = await import(`@/data/${siteSlug}/amenities.json`);
    return json.default ?? json;
  } catch {
    return [];
  }
}

// ── Reviews ──

export type ReviewData = {
  name: string;
  location: string;
  date: string;
  text: string;
};

export async function getReviewsData(
  siteSlug: string,
  _organizationId: string,
): Promise<ReviewData[]> {
  try {
    const rows = await getDb().select().from(reviews).limit(20);
    if (rows.length > 0) {
      return rows.map((r) => ({
        name:
          [r.guestFirstName, r.guestLastName].filter(Boolean).join(' ') ||
          'Guest',
        location: '',
        date: r.reviewedAt?.toISOString().slice(0, 10) ?? '',
        text: r.publicReview ?? '',
      }));
    }
  } catch {
    /* fall through */
  }
  try {
    const json = await import(`@/data/${siteSlug}/reviews.json`);
    return json.default ?? json;
  } catch {
    return [];
  }
}

// ── FAQs ──

export type FaqItem = { question: string; answer: string };

export async function getFaqData(propertyId: string): Promise<FaqItem[]> {
  try {
    const rows = await getDb()
      .select()
      .from(propertyFaqs)
      .where(eq(propertyFaqs.propertyId, propertyId));
    return rows.map((r) => ({ question: r.question, answer: r.answer ?? '' }));
  } catch {
    return [];
  }
}

// ── Blog Posts ──

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: string | null;
};

export async function getBlogPosts(
  _organizationId: string,
): Promise<BlogPost[]> {
  try {
    const rows = await getDb()
      .select()
      .from(seoDrafts)
      .where(eq(seoDrafts.status, 'published'))
      .limit(20);
    return rows.map((r) => ({
      slug: r.slug ?? r.id,
      title: r.titleTag ?? r.h1 ?? '',
      excerpt: r.metaDescription,
      publishedAt: r.generatedAt?.toISOString() ?? null,
    }));
  } catch {
    return [];
  }
}

// ── Events ──

export type EventData = {
  title: string;
  date: string | null;
  location: string | null;
};

export async function getEventsData(
  organizationId: string,
): Promise<EventData[]> {
  try {
    const rows = await getDb()
      .select()
      .from(seoEventCandidates)
      .where(eq(seoEventCandidates.organizationId, organizationId))
      .limit(20);
    return rows.map((r) => ({
      title: r.title ?? '',
      date: r.startsAt?.toISOString() ?? null,
      location: r.venueName ?? r.city ?? null,
    }));
  } catch {
    return [];
  }
}

// ── Static Content (JSON only) ──

export async function getStaticContent(
  siteSlug: string,
  page: string,
): Promise<Record<string, unknown> | null> {
  try {
    const json = await import(`@/data/${siteSlug}/${page}.json`);
    return json.default ?? json;
  } catch {
    return null;
  }
}
