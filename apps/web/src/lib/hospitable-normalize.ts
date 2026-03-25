import type { reservations, messages, properties, reviews } from '@walt/db';
import type { InferInsertModel } from 'drizzle-orm';

type ReservationInsert = InferInsertModel<typeof reservations>;
type MessageInsert = InferInsertModel<typeof messages>;
type PropertyInsert = InferInsertModel<typeof properties>;
type ReviewInsert = InferInsertModel<typeof reviews>;

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function ts(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

export function normalizeReservation(
  raw: Record<string, unknown>,
): Omit<ReservationInsert, 'syncedAt'> {
  const guest = (raw.guest ?? {}) as Record<string, unknown>;
  const props = Array.isArray(raw.properties) ? (raw.properties as Record<string, unknown>[]) : [];
  const firstProp = props[0] ?? {};

  // Extract pricing — Hospitable uses various field names
  const pricing = (raw.pricing ?? raw.price ?? raw.financials ?? {}) as Record<string, unknown>;
  const totalRaw = pricing.total ?? pricing.total_price ?? raw.total_price ?? raw.payout;
  const nightlyRaw = pricing.nightly ?? pricing.nightly_rate ?? raw.nightly_rate ?? pricing.per_night;
  const currencyRaw = pricing.currency ?? raw.currency;

  // Convert to cents (Hospitable may return dollars as float or cents as int)
  const toCents = (v: unknown): number | null => {
    const n = Number(v);
    if (isNaN(n)) return null;
    return n < 1000 && String(v).includes('.') ? Math.round(n * 100) : Math.round(n);
  };

  return {
    id: String(raw.id),
    conversationId: str(raw.conversation_id),
    platform: str(raw.platform),
    platformId: str(raw.platform_id),
    status: (() => {
      const rs = raw.reservation_status as Record<string, unknown> | undefined;
      const current = rs?.current as Record<string, unknown> | undefined;
      const category = current?.category;
      return str(category) ?? str(raw.status);
    })(),
    arrivalDate: ts(raw.arrival_date),
    departureDate: ts(raw.departure_date),
    checkIn: ts(raw.check_in),
    checkOut: ts(raw.check_out),
    bookingDate: ts(raw.booking_date),
    lastMessageAt: ts(raw.last_message_at),
    nights: num(raw.nights),
    guestId: str(guest.id),
    guestFirstName: str(guest.first_name),
    guestLastName: str(guest.last_name),
    guestEmail: str(guest.email),
    propertyId: str(firstProp.id),
    propertyName: str(firstProp.name),
    totalPrice: toCents(totalRaw),
    nightlyRate: toCents(nightlyRaw),
    currency: str(currencyRaw) ?? null,
    raw,
  };
}

export function normalizeProperty(raw: Record<string, unknown>): Omit<PropertyInsert, 'syncedAt'> {
  const addr = (raw.address ?? {}) as Record<string, unknown>;
  const capacity = (raw.capacity ?? {}) as Record<string, unknown>;
  const houseRules = (raw.house_rules ?? {}) as Record<string, unknown>;
  const coordinates = (addr.coordinates ?? {}) as Record<string, unknown>;
  const details = (raw.details ?? {}) as Record<string, unknown>;

  return {
    id: String(raw.id),
    name: String(raw.name ?? raw.public_name ?? ''),
    address: str(addr.street ?? addr.display) ?? null,
    city: str(addr.city) ?? null,
    status: raw.listed === false ? 'inactive' : 'active',
    raw,

    // Tier 1 — High AI value
    checkInTime: str(raw.checkin) ?? str(raw.check_in),
    checkOutTime: str(raw.checkout) ?? str(raw.check_out),
    timezone: str(raw.timezone),
    maxGuests: num(capacity.max) != null ? Math.round(num(capacity.max)!) : null,
    bedrooms: num(capacity.bedrooms) != null ? Math.round(num(capacity.bedrooms)!) : null,
    beds: num(capacity.beds) != null ? Math.round(num(capacity.beds)!) : null,
    bathrooms: capacity.bathrooms != null ? String(capacity.bathrooms) : null,
    petsAllowed: typeof houseRules.pets_allowed === 'boolean' ? houseRules.pets_allowed : null,
    smokingAllowed: typeof houseRules.smoking_allowed === 'boolean' ? houseRules.smoking_allowed : null,
    eventsAllowed: typeof houseRules.events_allowed === 'boolean' ? houseRules.events_allowed : null,
    amenities: Array.isArray(raw.amenities) ? (raw.amenities as string[]) : null,

    // Tier 2 — Descriptive & structural
    description: str(raw.description),
    summary: str(raw.summary),
    propertyType: str(raw.property_type),
    roomType: str(raw.room_type),
    pictureUrl: str(raw.picture),
    currency: str(raw.currency),
    addressState: str(addr.state),
    country: str(addr.country),
    postcode: str(addr.postcode),
    addressNumber: str(addr.number),
    latitude: typeof coordinates.latitude === 'number' ? coordinates.latitude : null,
    longitude: typeof coordinates.longitude === 'number' ? coordinates.longitude : null,
    listings: Array.isArray(raw.listings)
      ? (raw.listings as Array<{ platform: string; platform_id: string; platform_name?: string; platform_email?: string }>)
      : null,
    roomDetails: Array.isArray(raw.room_details)
      ? (raw.room_details as Array<{ type: string; quantity: number }>)
      : null,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : null,
    publicName: str(raw.public_name),
    calendarRestricted: typeof raw.calendar_restricted === 'boolean' ? raw.calendar_restricted : null,
    parentChild: raw.parent_child && typeof raw.parent_child === 'object'
      ? (raw.parent_child as { type: string; parent?: string; children?: string[]; siblings?: string[] })
      : null,
    icalImports: Array.isArray(raw.ical_imports)
      ? (raw.ical_imports as Array<{ uuid: string; url: string; name?: string }>)
      : null,

    // Property details (from Hospitable details field)
    wifiName: str(details.wifi_name),
    wifiPassword: str(details.wifi_password),
    houseManual: str(details.house_manual),
    guestAccess: str(details.guest_access),
    spaceOverview: str(details.space_overview),
    neighborhoodDescription: str(details.neighborhood_description),
    gettingAround: str(details.getting_around),
    additionalRules: str(details.additional_rules),
    otherDetails: str(details.other_details),
  };
}

export function normalizeReview(
  raw: Record<string, unknown>,
): Omit<ReviewInsert, 'syncedAt'> | null {
  const id = str(raw.id);
  if (!id) return null;

  const pub = (raw.public ?? {}) as Record<string, unknown>;
  const priv = (raw.private ?? {}) as Record<string, unknown>;
  const guest = (raw.guest ?? {}) as Record<string, unknown>;
  const reservation = (raw.reservation ?? {}) as Record<string, unknown>;
  const property = (raw.property ?? {}) as Record<string, unknown>;

  return {
    id,
    reservationId: str(reservation.id) ?? null,
    propertyId: str(property.id) ?? null,
    platform: str(raw.platform) ?? null,
    rating: typeof pub.rating === 'number' ? pub.rating : null,
    publicReview: str(pub.review) ?? null,
    publicResponse: str(pub.response) ?? null,
    privateFeedback: str(priv.feedback) ?? null,
    guestFirstName: str(guest.first_name) ?? null,
    guestLastName: str(guest.last_name) ?? null,
    reviewedAt: ts(raw.reviewed_at),
    respondedAt: ts(raw.responded_at),
    canRespond: typeof raw.can_respond === 'boolean' ? raw.can_respond : null,
    raw,
  };
}

export function normalizeMessage(
  raw: Record<string, unknown>,
  reservationId: string,
): Omit<MessageInsert, 'id'> | null {
  const body = str(raw.body);
  if (!body) return null;

  const sender = (raw.sender ?? {}) as Record<string, unknown>;
  const createdAt = ts(raw.created_at);
  if (!createdAt) return null;

  return {
    reservationId,
    platform: str(raw.platform),
    body,
    senderType: str(raw.sender_type) ?? 'unknown',
    senderFullName: str(sender.full_name),
    createdAt,
    suggestion: null,
    suggestionGeneratedAt: null,
    raw,
  };
}
