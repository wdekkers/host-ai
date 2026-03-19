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
