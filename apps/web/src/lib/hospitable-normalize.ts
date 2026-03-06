import type { reservations, messages } from '@walt/db';
import type { InferInsertModel } from 'drizzle-orm';

type ReservationInsert = InferInsertModel<typeof reservations>;
type MessageInsert = InferInsertModel<typeof messages>;

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

export function normalizeReservation(raw: Record<string, unknown>): Omit<ReservationInsert, 'syncedAt'> {
  const guest = (raw.guest ?? {}) as Record<string, unknown>;
  const props = Array.isArray(raw.properties) ? (raw.properties as Record<string, unknown>[]) : [];
  const firstProp = props[0] ?? {};

  return {
    id: String(raw.id),
    conversationId: str(raw.conversation_id),
    platform: str(raw.platform),
    platformId: str(raw.platform_id),
    status: str(raw.status),
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
    raw
  };
}

export function normalizeMessage(
  raw: Record<string, unknown>,
  reservationId: string
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
    raw
  };
}
