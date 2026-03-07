import { integer, jsonb, pgSchema, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const waltSchema = pgSchema('walt');

export const events = waltSchema.table('events', {
  id: uuid('id').primaryKey(),
  type: text('type').notNull(),
  accountId: uuid('account_id').notNull(),
  propertyId: uuid('property_id'),
  aggregateId: text('aggregate_id').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull()
});

export const organizations = waltSchema.table('organizations', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull()
});

export const organizationMemberships = waltSchema.table(
  'organization_memberships',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: text('user_id').notNull(),
    role: text('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.organizationId, table.userId] })
  })
);

export const propertyAccess = waltSchema.table(
  'property_access',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: text('user_id').notNull(),
    propertyId: text('property_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.organizationId, table.userId, table.propertyId] })
  })
);

export const properties = waltSchema.table('properties', {
  id: text('id').primaryKey(), // Hospitable property ID
  name: text('name').notNull(),
  address: text('address'),
  city: text('city'),
  status: text('status'),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull()
});

export const reservations = waltSchema.table('reservations', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id'),
  platform: text('platform'),
  platformId: text('platform_id'),
  status: text('status'),
  arrivalDate: timestamp('arrival_date', { withTimezone: true }),
  departureDate: timestamp('departure_date', { withTimezone: true }),
  checkIn: timestamp('check_in', { withTimezone: true }),
  checkOut: timestamp('check_out', { withTimezone: true }),
  bookingDate: timestamp('booking_date', { withTimezone: true }),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  nights: integer('nights'),
  guestId: text('guest_id'),
  guestFirstName: text('guest_first_name'),
  guestLastName: text('guest_last_name'),
  guestEmail: text('guest_email'),
  propertyId: text('property_id'),
  propertyName: text('property_name'),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull()
});

export const propertyFaqs = waltSchema.table(
  'property_faqs',
  {
    id: uuid('id').primaryKey(),
    propertyId: text('property_id').notNull(),
    category: text('category').notNull(),
    question: text('question').notNull(),
    answer: text('answer'),
    examples: jsonb('examples').$type<string[]>(),
    analysedAt: timestamp('analysed_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
  },
  (table) => ({
    uniq: uniqueIndex('property_faqs_property_category_idx').on(table.propertyId, table.category)
  })
);

export const messages = waltSchema.table(
  'messages',
  {
    id: uuid('id').primaryKey(),
    reservationId: text('reservation_id')
      .notNull()
      .references(() => reservations.id),
    platform: text('platform'),
    body: text('body').notNull(),
    senderType: text('sender_type').notNull(),
    senderFullName: text('sender_full_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    suggestion: text('suggestion'),
    suggestionGeneratedAt: timestamp('suggestion_generated_at', { withTimezone: true }),
    raw: jsonb('raw').notNull()
  },
  (table) => ({
    uniq: uniqueIndex('messages_reservation_created_at_idx').on(table.reservationId, table.createdAt)
  })
);
