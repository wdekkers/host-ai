import {
  boolean,
  check,
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
import { sql } from 'drizzle-orm';

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
  isActive: boolean('is_active').notNull().default(true),
  hasPool: boolean('has_pool').notNull().default(false),
  iaqualinkDeviceSerial: text('iaqualink_device_serial'),
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
  totalPrice: integer('total_price'), // cents
  nightlyRate: integer('nightly_rate'), // cents
  currency: text('currency'), // e.g. 'USD', 'EUR'
  guestScore: integer('guest_score'),
  guestScoreSummary: text('guest_score_summary'),
  guestScoredAt: timestamp('guest_scored_at', { withTimezone: true }),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull(),
});

export const hostAgainEnum = waltSchema.enum('host_again', ['yes', 'no', 'undecided']);

export const guests = waltSchema.table('guests', {
  id: text('id').primaryKey(), // internal UUID
  organizationId: text('organization_id').notNull(),
  platformGuestId: text('platform_guest_id'), // Hospitable / Airbnb guest ID
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email'),
  phone: text('phone'),
  hostAgain: hostAgainEnum('host_again').notNull().default('undecided'),
  rating: integer('rating'), // 1–5 stars, null = not rated
  notes: text('notes'), // internal notes, never shown to guest
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
}, (table) => [
  uniqueIndex('guests_org_platform_guest_idx').on(table.organizationId, table.platformGuestId),
]);

export const reviews = waltSchema.table('reviews', {
  id: text('id').primaryKey(), // Hospitable review UUID
  reservationId: text('reservation_id'),
  propertyId: text('property_id'),
  platform: text('platform'), // airbnb | direct
  rating: integer('rating'),
  publicReview: text('public_review'),
  publicResponse: text('public_response'),
  privateFeedback: text('private_feedback'),
  guestFirstName: text('guest_first_name'),
  guestLastName: text('guest_last_name'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  canRespond: boolean('can_respond'),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull(),
});

export const knowledgeEntries = waltSchema.table(
  'knowledge_entries',
  {
    id: uuid('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    scope: text('scope').notNull(),
    propertyId: text('property_id'),
    entryType: text('entry_type').notNull(),
    topicKey: text('topic_key').notNull(),
    title: text('title'),
    question: text('question'),
    answer: text('answer'),
    body: text('body'),
    channels: text('channels').array().notNull().default([]),
    status: text('status').notNull().default('draft'),
    sortOrder: integer('sort_order').notNull().default(0),
    slug: text('slug'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    orgIdx: index('knowledge_entries_organization_id_idx').on(table.organizationId),
    propertyIdx: index('knowledge_entries_property_id_idx').on(table.propertyId),
    lookupIdx: index('knowledge_entries_organization_id_scope_topic_key_idx').on(
      table.organizationId,
      table.scope,
      table.topicKey,
    ),
    scopePropertyIdCheck: check(
      'knowledge_entries_scope_property_id_check',
      sql`(scope = 'global' AND property_id IS NULL) OR (scope = 'property' AND property_id IS NOT NULL)`,
    ),
    globalUniqueIdx: uniqueIndex('knowledge_entries_global_unique_idx')
      .on(table.organizationId, table.topicKey)
      .where(sql`${table.scope} = 'global'`),
    propertyUniqueIdx: uniqueIndex('knowledge_entries_property_unique_idx')
      .on(table.organizationId, table.propertyId, table.topicKey)
      .where(sql`${table.scope} = 'property'`),
  }),
);

export const propertyFaqs = waltSchema.table(
  'property_faqs',
  {
    id: uuid('id').primaryKey(),
    propertyId: text('property_id').notNull(),
    category: text('category').notNull(),
    question: text('question').notNull(),
    answer: text('answer'),
    examples: jsonb('examples').$type<string[]>(),
    reviewStatus: text('review_status').notNull().default('unreviewed'), // unreviewed | approved | manually_verified
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
    suggestionScannedAt: timestamp('suggestion_scanned_at', { withTimezone: true }),
    draftStatus: text('draft_status'),
    intent: text('intent'),
    escalationLevel: text('escalation_level'),
    escalationReason: text('escalation_reason'),
    sourcesUsed: jsonb('sources_used'),
  },
  (table) => ({
    uniq: uniqueIndex('messages_reservation_created_at_idx').on(
      table.reservationId,
      table.createdAt,
    ),
  }),
);

export const draftEvents = waltSchema.table(
  'draft_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id),
    action: text('action').notNull(),
    actorId: text('actor_id'),
    beforePayload: text('before_payload'),
    afterPayload: text('after_payload'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    messageCreatedIdx: index('draft_events_message_created_idx').on(
      table.messageId,
      table.createdAt,
    ),
    orgCreatedIdx: index('draft_events_org_created_idx').on(
      table.organizationId,
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

// --- Agent Config ---

export const agentConfigs = waltSchema.table(
  'agent_configs',
  {
    id: uuid('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    scope: text('scope').notNull(), // 'global' | 'property'
    propertyId: text('property_id'),
    tone: text('tone'),
    emojiUse: text('emoji_use'),
    responseLength: text('response_length'),
    escalationRules: text('escalation_rules'),
    specialInstructions: text('special_instructions'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    orgScopeIdx: index('agent_configs_organization_id_scope_idx').on(
      table.organizationId,
      table.scope,
    ),
  }),
);

// --- Property Memory ---

export const propertyMemory = waltSchema.table(
  'property_memory',
  {
    id: uuid('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    propertyId: text('property_id').notNull(),
    fact: text('fact').notNull(),
    source: text('source').notNull().default('manual'),
    sourceReservationId: text('source_reservation_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    orgPropertyIdx: index('property_memory_organization_id_property_id_idx').on(
      table.organizationId,
      table.propertyId,
    ),
  }),
);

// --- Property Guidebook Entries ---

export const propertyGuidebookEntries = waltSchema.table(
  'property_guidebook_entries',
  {
    id: uuid('id').primaryKey(),
    propertyId: text('property_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    mediaUrl: text('media_url'),
    aiUseCount: integer('ai_use_count').notNull().default(0),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => ({
    propertyIdx: index('property_guidebook_entries_property_id_idx').on(table.propertyId),
  }),
);

// --- Checklists ---

export const checklistCategoryEnum = waltSchema.enum('checklist_category', [
  'turnover',
  'house_manager',
  'maintenance',
  'seasonal',
]);

export const checklistScopeEnum = waltSchema.enum('checklist_scope', ['global', 'property']);

export const checklists = waltSchema.table('checklists', {
  id: uuid('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  name: text('name').notNull(),
  category: checklistCategoryEnum('category').notNull().default('turnover'),
  scope: checklistScopeEnum('scope').notNull().default('property'),
  propertyId: text('property_id'), // null when scope = 'global'
  assignedRole: text('assigned_role'), // optional: 'cleaner', 'agent', etc.
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const checklistItems = waltSchema.table('checklist_items', {
  id: uuid('id').primaryKey(),
  checklistId: uuid('checklist_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  index('checklist_items_checklist_id_idx').on(table.checklistId),
]);

// --- SEO Draft Pipeline ---

export const seoPipelineRuns = waltSchema.table(
  'seo_pipeline_runs',
  {
    id: uuid('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    marketKey: text('market_key').notNull(),
    siteKey: text('site_key').notNull(),
    trigger: text('trigger').notNull().default('manual'),
    status: text('status').notNull(),
    createdBy: text('created_by').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    errorSummary: text('error_summary'),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (table) => ({
    orgIdx: index('seo_pipeline_runs_organization_id_idx').on(table.organizationId),
    marketSiteIdx: index('seo_pipeline_runs_market_key_site_key_idx').on(
      table.marketKey,
      table.siteKey,
    ),
  }),
);

export const seoEventCandidates = waltSchema.table(
  'seo_event_candidates',
  {
    id: uuid('id').primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => seoPipelineRuns.id),
    organizationId: text('organization_id').notNull(),
    marketKey: text('market_key').notNull(),
    sourceId: text('source_id').notNull(),
    sourceUrl: text('source_url').notNull(),
    sourceDomain: text('source_domain').notNull(),
    title: text('title').notNull(),
    venueName: text('venue_name'),
    city: text('city'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    summary: text('summary'),
    sourceSnippet: text('source_snippet'),
    normalizedHash: text('normalized_hash').notNull(),
    status: text('status').notNull().default('discovered'),
    raw: jsonb('raw').notNull(),
    discoveredAt: timestamp('discovered_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    uniq: uniqueIndex('seo_event_candidates_org_market_hash_idx').on(
      table.organizationId,
      table.marketKey,
      table.normalizedHash,
    ),
  }),
);

export const seoOpportunities = waltSchema.table(
  'seo_opportunities',
  {
    id: uuid('id').primaryKey(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => seoEventCandidates.id),
    organizationId: text('organization_id').notNull(),
    marketKey: text('market_key').notNull(),
    siteKey: text('site_key').notNull(),
    targetKeyword: text('target_keyword').notNull(),
    targetSlug: text('target_slug').notNull(),
    travelerIntent: text('traveler_intent').notNull(),
    propertyIds: text('property_ids').array().notNull().default([]),
    score: integer('score').notNull(),
    reasons: jsonb('reasons').$type<string[]>().notNull(),
    status: text('status').notNull().default('queued'),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    candidateIdx: uniqueIndex('seo_opportunities_candidate_id_idx').on(table.candidateId),
    orgScoreIdx: index('seo_opportunities_organization_id_score_idx').on(
      table.organizationId,
      table.score,
    ),
  }),
);

export const seoDrafts = waltSchema.table(
  'seo_drafts',
  {
    id: uuid('id').primaryKey(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => seoOpportunities.id),
    organizationId: text('organization_id').notNull(),
    marketKey: text('market_key').notNull(),
    siteKey: text('site_key').notNull(),
    status: text('status').notNull().default('generated'),
    titleTag: text('title_tag').notNull(),
    metaDescription: text('meta_description').notNull(),
    slug: text('slug').notNull(),
    h1: text('h1').notNull(),
    outline: jsonb('outline').$type<string[]>().notNull(),
    bodyMarkdown: text('body_markdown').notNull(),
    faqItems: jsonb('faq_items')
      .$type<Array<{ question: string; answer: string }>>()
      .notNull(),
    ctaText: text('cta_text').notNull(),
    internalLinks: jsonb('internal_links')
      .$type<Array<{ href: string; anchor: string }>>()
      .notNull(),
    sourceUrls: text('source_urls').array().notNull().default([]),
    reviewNotes: text('review_notes').array().notNull().default([]),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: text('reviewed_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    opportunityIdx: uniqueIndex('seo_drafts_opportunity_id_idx').on(table.opportunityId),
    orgStatusUpdatedIdx: index('seo_drafts_organization_id_status_updated_at_idx').on(
      table.organizationId,
      table.status,
      table.updatedAt,
    ),
    siteSlugIdx: uniqueIndex('seo_drafts_site_key_slug_idx').on(table.siteKey, table.slug),
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

// --- Daily Operations Dashboard ---

export const taskSuggestions = waltSchema.table(
  'task_suggestions',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id').notNull(),
    propertyId: text('property_id').notNull(),
    propertyName: text('property_name').notNull(),
    reservationId: text('reservation_id').notNull(),
    messageId: uuid('message_id'),
    title: text('title').notNull(),
    description: text('description'),
    suggestedDueDate: timestamp('suggested_due_date', { withTimezone: true }),
    source: text('source').notNull(), // 'message' | 'reservation'
    status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'dismissed'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  },
  (table) => ({
    orgStatusIdx: index('task_suggestions_org_status_idx').on(
      table.organizationId,
      table.status,
    ),
    uniqueConstraint: uniqueIndex('task_suggestions_org_reservation_title_idx').on(
      table.organizationId,
      table.reservationId,
      table.title,
    ),
  }),
);

export const taskReminders = waltSchema.table(
  'task_reminders',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    taskId: text('task_id').notNull(),
    organizationId: text('organization_id').notNull(),
    taskTitle: text('task_title').notNull(),
    propertyName: text('property_name').notNull(),
    channels: text('channels').array().notNull(),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  },
  (table) => ({
    pendingIdx: index('task_reminders_pending_idx')
      .on(table.scheduledFor)
      .where(sql`${table.sentAt} IS NULL`),
  }),
);

export const poolTemperatureReadings = waltSchema.table(
  'pool_temperature_readings',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    propertyId: text('property_id').notNull(),
    deviceSerial: text('device_serial').notNull(),
    temperatureF: integer('temperature_f'),
    polledAt: timestamp('polled_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    propertyPolledAtIdx: index('pool_temperature_readings_property_polled_at_idx').on(
      table.propertyId,
      table.polledAt.desc(),
    ),
  }),
);

// --- Ops Chat ---

export const opsThreadTypeEnum = waltSchema.enum('ops_thread_type', ['direct', 'group']);

export const opsThreads = waltSchema.table('ops_threads', {
  id: uuid('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  name: text('name'), // null for direct threads, required for group
  type: opsThreadTypeEnum('type').notNull().default('direct'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const opsThreadParticipants = waltSchema.table('ops_thread_participants', {
  id: uuid('id').primaryKey(),
  threadId: uuid('thread_id').notNull(),
  displayName: text('display_name').notNull(),
  phoneE164: text('phone_e164').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().default(sql`now()`),
}, (table) => [
  index('ops_thread_participants_thread_id_idx').on(table.threadId),
]);

export const opsMessages = waltSchema.table('ops_messages', {
  id: uuid('id').primaryKey(),
  threadId: uuid('thread_id').notNull(),
  senderName: text('sender_name'), // null for outbound (system/host)
  senderPhone: text('sender_phone'), // null for outbound
  direction: messageDirectionEnum('direction').notNull(),
  body: text('body').notNull(),
  twilioMessageSid: text('twilio_message_sid'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
}, (table) => [
  index('ops_messages_thread_id_idx').on(table.threadId),
]);

// --- Property Inventory ---

export const inventoryRooms = waltSchema.table('inventory_rooms', {
  id: uuid('id').primaryKey(),
  propertyId: text('property_id').notNull(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  index('inventory_rooms_property_id_idx').on(table.propertyId),
]);

export const inventoryItems = waltSchema.table('inventory_items', {
  id: uuid('id').primaryKey(),
  roomId: uuid('room_id').notNull(),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull().default(0),
  minQuantity: integer('min_quantity').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
}, (table) => [
  index('inventory_items_room_id_idx').on(table.roomId),
]);

// --- Property Appliances ---

export const propertyAppliances = waltSchema.table('property_appliances', {
  id: uuid('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  propertyId: text('property_id').notNull(),
  name: text('name').notNull(),
  brand: text('brand'),
  modelNumber: text('model_number'),
  serialNumber: text('serial_number'),
  location: text('location'),
  purchaseDate: timestamp('purchase_date', { withTimezone: true }),
  warrantyExpiration: timestamp('warranty_expiration', { withTimezone: true }),
  photoUrl: text('photo_url'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
}, (table) => [
  index('property_appliances_property_id_active_idx').on(table.propertyId, table.isActive),
]);

// --- Guest Simulator ---

export const simulatorQuestionSets = waltSchema.table('simulator_question_sets', {
  id: uuid('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  propertyId: text('property_id').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
}, (table) => [
  index('simulator_question_sets_org_property_idx').on(table.organizationId, table.propertyId),
]);

export const simulatorQuestions = waltSchema.table('simulator_questions', {
  id: uuid('id').primaryKey(),
  questionSetId: uuid('question_set_id').notNull(),
  question: text('question').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  index('simulator_questions_set_id_idx').on(table.questionSetId),
]);

export const simulatorRuns = waltSchema.table('simulator_runs', {
  id: uuid('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  propertyId: text('property_id').notNull(),
  questionSetId: uuid('question_set_id').notNull(),
  summary: jsonb('summary').notNull(),
  agentConfigSnapshot: jsonb('agent_config_snapshot'),
  knowledgeCount: integer('knowledge_count'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
}, (table) => [
  index('simulator_runs_property_created_idx').on(table.propertyId, table.createdAt),
]);

export const simulatorResults = waltSchema.table('simulator_results', {
  id: uuid('id').primaryKey(),
  runId: uuid('run_id').notNull(),
  question: text('question').notNull(),
  response: text('response').notNull(),
  grade: text('grade').notNull(),
  gradeReason: text('grade_reason').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
}, (table) => [
  index('simulator_results_run_id_idx').on(table.runId),
]);
