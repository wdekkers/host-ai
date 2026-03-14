import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const waltSchema = pgSchema('walt');

export const events = waltSchema.table('events', {
  id: uuid('id').primaryKey(),
  type: text('type').notNull(),
  accountId: uuid('account_id').notNull(),
  propertyId: uuid('property_id'),
  aggregateId: text('aggregate_id').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const organizations = waltSchema.table('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const organizationMemberships = waltSchema.table(
  'organization_memberships',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: text('user_id').notNull(),
    role: text('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.organizationId, table.userId] }),
  }),
);

export const propertyAccess = waltSchema.table(
  'property_access',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: text('user_id').notNull(),
    propertyId: text('property_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.organizationId, table.userId, table.propertyId] }),
  }),
);

export const properties = waltSchema.table('properties', {
  id: text('id').primaryKey(), // Hospitable property ID
  name: text('name').notNull(),
  address: text('address'),
  city: text('city'),
  status: text('status'),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull(),
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
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull(),
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
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    uniq: uniqueIndex('property_faqs_property_category_idx').on(table.propertyId, table.category),
  }),
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
    raw: jsonb('raw').notNull(),
  },
  (table) => ({
    uniq: uniqueIndex('messages_reservation_created_at_idx').on(
      table.reservationId,
      table.createdAt,
    ),
  }),
);

// --- Tasks ---

export const taskCategories = waltSchema.table(
  'task_categories',
  {
    id: uuid('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    name: text('name').notNull(),
    color: text('color'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    createdBy: text('created_by').notNull(),
  },
  (table) => ({
    orgIdx: index('task_categories_organization_id_idx').on(table.organizationId),
  }),
);

export const tasks = waltSchema.table(
  'tasks',
  {
    id: uuid('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull().default('open'),
    priority: text('priority').notNull().default('medium'),
    categoryId: uuid('category_id'),
    assigneeId: text('assignee_id'),
    propertyIds: text('property_ids').array().notNull().default([]),
    dueDate: timestamp('due_date', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: text('resolved_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    createdBy: text('created_by').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    updatedBy: text('updated_by').notNull(),
  },
  (table) => ({
    orgIdx: index('tasks_organization_id_idx').on(table.organizationId),
  }),
);

export const taskAuditEvents = waltSchema.table(
  'task_audit_events',
  {
    id: uuid('id').primaryKey(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id),
    organizationId: text('organization_id').notNull(),
    action: text('action').notNull(),
    changedBy: text('changed_by').notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull(),
    delta: jsonb('delta').notNull(),
  },
  (table) => ({
    taskIdx: index('task_audit_events_task_id_idx').on(table.taskId),
  }),
);

// --- Vendor Messaging Consent ---

export const vendorStatusEnum = waltSchema.enum('vendor_status', [
  'invited',
  'active',
  'opted_out',
  'blocked',
]);

export const consentStatusEnum = waltSchema.enum('consent_status', [
  'opted_in',
  'opted_out',
  'pending',
]);

export const consentMethodEnum = waltSchema.enum('consent_method', [
  'web_form',
  'inbound_sms',
  'admin_import',
]);

export const messageDirectionEnum = waltSchema.enum('message_direction', ['outbound', 'inbound']);

export const messageTypeEnum = waltSchema.enum('message_type', [
  'operational',
  'consent_confirmation',
  'help',
  'stop_confirmation',
]);

export const actorTypeEnum = waltSchema.enum('actor_type', ['system', 'admin', 'vendor']);

export const vendors = waltSchema.table('vendors', {
  id: uuid('id').primaryKey(),
  companyName: text('company_name').notNull(),
  contactName: text('contact_name').notNull(),
  phoneE164: text('phone_e164').notNull().unique(),
  email: text('email'),
  status: vendorStatusEnum('status').notNull().default('invited'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const smsConsents = waltSchema.table('sms_consents', {
  id: uuid('id').primaryKey(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id),
  consentStatus: consentStatusEnum('consent_status').notNull(),
  consentMethod: consentMethodEnum('consent_method').notNull(),
  consentTextVersion: text('consent_text_version').notNull(),
  consentTextSnapshot: text('consent_text_snapshot').notNull(),
  sourceUrl: text('source_url').notNull(),
  sourceDomain: text('source_domain').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  checkboxChecked: boolean('checkbox_checked').notNull(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const smsMessageLogs = waltSchema.table('sms_message_logs', {
  id: uuid('id').primaryKey(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id),
  direction: messageDirectionEnum('direction').notNull(),
  twilioMessageSid: text('twilio_message_sid'),
  fromNumber: text('from_number').notNull(),
  toNumber: text('to_number').notNull(),
  body: text('body').notNull(),
  messageType: messageTypeEnum('message_type').notNull(),
  deliveryStatus: text('delivery_status'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const auditEvents = waltSchema.table('audit_events', {
  id: uuid('id').primaryKey(),
  // Not a FK so orphaned events survive vendor deletion
  vendorId: uuid('vendor_id'),
  actorType: actorTypeEnum('actor_type').notNull(),
  actorId: text('actor_id'),
  eventType: text('event_type').notNull(),
  metadata: jsonb('metadata').notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});
