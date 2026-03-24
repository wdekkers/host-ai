# AI-Native Journey Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI-native journey engine that lets hosts describe automations in natural language, with upsell capabilities, multi-channel notifications, coverage scheduling, and per-conversation AI controls.

**Architecture:** Thin workflow engine (scheduling + state) with AI handling content generation and runtime decisions. Journeys are stored as JSON step arrays in Postgres, enrolled per-reservation, and executed by a cron-based loop. Four new `@walt/*` packages provide provider-agnostic notification routing.

**Tech Stack:** Next.js (existing), Drizzle ORM, PostgreSQL, OpenAI GPT-4o-mini, Zod, Node built-in test runner, Twilio (SMS), Resend (email), Slack API.

**Spec:** `docs/superpowers/specs/2026-03-24-ai-native-journey-engine-design.md`

---

## File Structure

### New Packages

```
packages/sms/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts              # Re-exports
    ├── client.ts             # Provider-agnostic SmsSender interface + TwilioSmsSender
    └── client.test.ts

packages/email/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── client.ts             # Provider-agnostic EmailSender interface + ResendEmailSender
    └── client.test.ts

packages/slack/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── client.ts             # SlackClient (post message, channel lookup)
    └── client.test.ts

packages/notifications/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── router.ts             # NotificationRouter — resolves prefs, dispatches to channels
    ├── router.test.ts
    └── types.ts              # Notification, NotificationChannel, NotificationPreference types
```

### New Contract Schemas

```
packages/contracts/src/
├── journeys.ts               # Journey Zod schemas (step, trigger, coverage, definition)
├── notifications.ts          # Notification input/preference Zod schemas
└── auth.ts                   # (modify) Add journeys.*, conversations.*, upsells.*, notifications.* permissions
```

### Database Changes

```
packages/db/src/schema.ts     # Add 8 new tables
packages/db/drizzle/          # Auto-generated migration
```

### New App Code

```
apps/web/src/lib/
├── journeys/
│   ├── generate-journey.ts           # AI journey creation from prompt
│   ├── generate-journey.test.ts
│   ├── generate-journey-message.ts   # AI message gen for journey steps (adapted from generate-reply-suggestion)
│   ├── generate-journey-message.test.ts
│   ├── executor.ts                   # Journey step executor
│   ├── executor.test.ts
│   ├── enrollment.ts                 # Enrollment trigger logic
│   ├── enrollment.test.ts
│   ├── coverage.ts                   # Coverage schedule evaluation
│   └── coverage.test.ts
└── notifications/
    ├── send-notification.ts          # High-level send via @walt/notifications
    └── send-notification.test.ts

apps/web/src/app/api/
├── journeys/
│   ├── handler.ts                    # List + create journeys
│   ├── route.ts
│   ├── generate/
│   │   ├── handler.ts                # AI generate journey from prompt
│   │   └── route.ts
│   ├── generate/edit/
│   │   ├── handler.ts                # AI edit existing journey
│   │   └── route.ts
│   └── [id]/
│       ├── handler.ts                # Get, update, delete, activate, pause
│       ├── route.ts
│       ├── activate/
│       │   ├── handler.ts
│       │   └── route.ts
│       ├── pause/
│       │   ├── handler.ts
│       │   └── route.ts
│       ├── exclude/
│       │   ├── handler.ts
│       │   └── route.ts
│       └── enrollments/
│           ├── handler.ts            # List enrollments, cancel, exclude
│           ├── route.ts
│           └── [enrollmentId]/
│               └── cancel/
│                   ├── handler.ts
│                   └── route.ts
├── upsells/
│   ├── handler.ts                    # List + update upsell events
│   ├── route.ts
│   ├── stats/
│   │   ├── handler.ts
│   │   └── route.ts
│   └── [id]/
│       ├── handler.ts
│       └── route.ts
├── notifications/
│   ├── handler.ts                    # List, unread count
│   ├── route.ts
│   ├── preferences/
│   │   ├── handler.ts
│   │   └── route.ts
│   ├── read-all/
│   │   ├── handler.ts
│   │   └── route.ts
│   └── [id]/
│       └── read/
│           ├── handler.ts
│           └── route.ts
├── conversations/
│   └── [reservationId]/
│       └── ai-status/
│           ├── handler.ts            # Pause/resume AI per conversation
│           └── route.ts
└── cron/
    ├── execute-journeys/
    │   ├── handler.ts
    │   ├── handler.test.ts
    │   └── route.ts
    ├── enroll-time-triggers/
    │   ├── handler.ts
    │   ├── handler.test.ts
    │   └── route.ts
    └── detect-gaps/
        ├── handler.ts
        ├── handler.test.ts
        └── route.ts
```

---

## Task 1: Journey Zod Schemas in @walt/contracts

**Files:**
- Create: `packages/contracts/src/journeys.ts`
- Modify: `packages/contracts/src/index.ts`

These schemas are the foundation — everything else depends on them.

- [ ] **Step 1: Write journey step schema tests**

Create a test file to validate the Zod schemas parse correctly and reject invalid input:

```
packages/contracts/src/journeys.test.ts
```

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  journeyStepSchema,
  triggerConfigSchema,
  coverageScheduleSchema,
  journeyDefinitionSchema,
} from './journeys';

void test('journeyStepSchema accepts valid send_message step', () => {
  const result = journeyStepSchema.safeParse({
    type: 'send_message',
    directive: 'Thank the guest for booking',
  });
  assert.equal(result.success, true);
});

void test('journeyStepSchema accepts valid wait step with delay', () => {
  const result = journeyStepSchema.safeParse({
    type: 'wait',
    directive: { delayMinutes: 30 },
  });
  assert.equal(result.success, true);
});

void test('journeyStepSchema accepts valid wait step with until', () => {
  const result = journeyStepSchema.safeParse({
    type: 'wait',
    directive: { until: 'check_in', offsetHours: -24 },
  });
  assert.equal(result.success, true);
});

void test('journeyStepSchema accepts valid ai_decision with skipToStep', () => {
  const result = journeyStepSchema.safeParse({
    type: 'ai_decision',
    directive: 'Is the calendar free the night before?',
    skipToStep: 5,
  });
  assert.equal(result.success, true);
});

void test('journeyStepSchema rejects unknown step type', () => {
  const result = journeyStepSchema.safeParse({
    type: 'unknown_type',
    directive: 'do something',
  });
  assert.equal(result.success, false);
});

void test('triggerConfigSchema accepts check_in_approaching config', () => {
  const result = triggerConfigSchema.safeParse({
    triggerType: 'check_in_approaching',
    config: { offsetHours: -48 },
  });
  assert.equal(result.success, true);
});

void test('triggerConfigSchema accepts gap_detected config', () => {
  const result = triggerConfigSchema.safeParse({
    triggerType: 'gap_detected',
    config: { maxGapNights: 2 },
  });
  assert.equal(result.success, true);
});

void test('coverageScheduleSchema accepts valid schedule', () => {
  const result = coverageScheduleSchema.safeParse({
    timezone: 'America/New_York',
    windows: [
      { days: ['mon', 'tue', 'wed', 'thu', 'fri'], startHour: 9, endHour: 22 },
      { days: ['sat', 'sun'], startHour: 0, endHour: 24 },
    ],
  });
  assert.equal(result.success, true);
});

void test('coverageScheduleSchema rejects invalid day', () => {
  const result = coverageScheduleSchema.safeParse({
    timezone: 'America/New_York',
    windows: [{ days: ['monday'], startHour: 9, endHour: 22 }],
  });
  assert.equal(result.success, false);
});

void test('journeyDefinitionSchema validates a complete journey', () => {
  const result = journeyDefinitionSchema.safeParse({
    name: 'Welcome Journey',
    description: 'Greets guests on booking',
    triggerType: 'booking_confirmed',
    triggerConfig: {},
    steps: [
      { type: 'send_message', directive: 'Welcome the guest' },
      { type: 'wait', directive: { until: 'check_in', offsetHours: -48 } },
      { type: 'send_message', directive: 'Send pre-arrival info' },
    ],
    coverageSchedule: null,
    approvalMode: 'draft',
  });
  assert.equal(result.success, true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/contracts && npx tsx --test src/journeys.test.ts`
Expected: FAIL — module `./journeys` not found

- [ ] **Step 3: Write the Zod schemas**

Create `packages/contracts/src/journeys.ts`:

```typescript
import { z } from 'zod';

// --- Step Types ---

const dayOfWeekSchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;

const waitUntilAnchorSchema = z.enum([
  'check_in', 'check_out', 'booking_confirmed', 'check_in_approaching', 'check_out_approaching',
]);

const waitDirectiveSchema = z.union([
  z.object({ delayMinutes: z.number().int().positive() }),
  z.object({ until: waitUntilAnchorSchema, offsetHours: z.number().int() }),
]);

const createTaskDirectiveSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  description: z.string().optional(),
});

const sendNotificationDirectiveSchema = z.object({
  channels: z.array(z.enum(['sms', 'email', 'slack', 'web'])).min(1),
  message: z.string().min(1),
});

const pauseAiDirectiveSchema = z.object({
  reason: z.string().optional(),
});

const stepTypeSchema = z.enum([
  'send_message', 'wait', 'ai_decision', 'create_task',
  'send_notification', 'upsell_offer', 'pause_ai', 'resume_ai',
]);

export const journeyStepSchema = z.object({
  type: stepTypeSchema,
  directive: z.union([z.string(), z.record(z.unknown())]),
  skipToStep: z.number().int().nonnegative().optional(),
});
export type JourneyStep = z.infer<typeof journeyStepSchema>;

// --- Trigger Types ---

const triggerTypeSchema = z.enum([
  'booking_confirmed', 'check_in_approaching', 'check_in',
  'check_out_approaching', 'check_out', 'message_received',
  'gap_detected', 'sentiment_changed', 'booking_cancelled', 'manual',
]);
export type TriggerType = z.infer<typeof triggerTypeSchema>;

export const triggerConfigSchema = z.object({
  triggerType: triggerTypeSchema,
  config: z.record(z.unknown()).default({}),
});
export type TriggerConfig = z.infer<typeof triggerConfigSchema>;

// --- Coverage Schedule ---

const coverageWindowSchema = z.object({
  days: z.array(dayOfWeekSchema).min(1),
  startHour: z.number().int().min(0).max(24),
  endHour: z.number().int().min(0).max(24),
});

export const coverageScheduleSchema = z.object({
  timezone: z.string().min(1),
  windows: z.array(coverageWindowSchema).min(1),
});
export type CoverageSchedule = z.infer<typeof coverageScheduleSchema>;

// --- Journey Definition (for AI generation output validation) ---

const journeyStatusSchema = z.enum(['draft', 'active', 'paused', 'archived']);
export type JourneyStatus = z.infer<typeof journeyStatusSchema>;

const approvalModeSchema = z.enum(['draft', 'auto_with_exceptions', 'autonomous']);
export type ApprovalMode = z.infer<typeof approvalModeSchema>;

export const journeyDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  triggerType: triggerTypeSchema,
  triggerConfig: z.record(z.unknown()).default({}),
  steps: z.array(journeyStepSchema).min(1),
  coverageSchedule: coverageScheduleSchema.nullable(),
  approvalMode: approvalModeSchema.default('draft'),
});
export type JourneyDefinition = z.infer<typeof journeyDefinitionSchema>;

// --- Enrollment ---

const enrollmentStatusSchema = z.enum(['active', 'completed', 'cancelled', 'paused']);
export type EnrollmentStatus = z.infer<typeof enrollmentStatusSchema>;

// --- Execution Log ---

const executionActionSchema = z.enum([
  'message_drafted', 'message_sent', 'task_created', 'notification_sent',
  'ai_decision', 'ai_paused', 'ai_resumed', 'skipped', 'escalated', 'failed',
]);
export type ExecutionAction = z.infer<typeof executionActionSchema>;

// --- Upsell ---

const upsellTypeSchema = z.enum([
  'gap_night', 'early_checkin', 'late_checkout', 'stay_extension', 'custom',
]);
export type UpsellType = z.infer<typeof upsellTypeSchema>;

const upsellStatusSchema = z.enum(['offered', 'accepted', 'declined', 'expired']);
export type UpsellStatus = z.infer<typeof upsellStatusSchema>;

// --- AI Status ---

const aiStatusSchema = z.enum(['active', 'paused']);
export type AiStatus = z.infer<typeof aiStatusSchema>;

// --- API Input Schemas ---

export const generateJourneyInputSchema = z.object({
  prompt: z.string().min(10),
  propertyIds: z.array(z.string()).default([]),
});
export type GenerateJourneyInput = z.infer<typeof generateJourneyInputSchema>;

export const editJourneyInputSchema = z.object({
  journeyId: z.string().uuid(),
  instruction: z.string().min(5),
});
export type EditJourneyInput = z.infer<typeof editJourneyInputSchema>;

export const updateAiStatusInputSchema = z.object({
  status: aiStatusSchema,
  pauseDurationMinutes: z.number().int().positive().nullable().optional(),
});
export type UpdateAiStatusInput = z.infer<typeof updateAiStatusInputSchema>;

export const updateUpsellInputSchema = z.object({
  status: upsellStatusSchema,
  actualRevenue: z.number().int().nonnegative().nullable().optional(),
});
export type UpdateUpsellInput = z.infer<typeof updateUpsellInputSchema>;
```

- [ ] **Step 4: Export from contracts index**

Add to `packages/contracts/src/index.ts` (note: use `.js` extension to match existing re-export pattern):

```typescript
export * from './journeys.js';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/contracts && npx tsx --test src/journeys.test.ts`
Expected: All 10 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/journeys.ts packages/contracts/src/journeys.test.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): add journey engine Zod schemas"
```

---

## Task 1b: Notification Schemas + Permissions in @walt/contracts

**Files:**
- Create: `packages/contracts/src/notifications.ts`
- Modify: `packages/contracts/src/auth.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Add notification Zod schemas**

Create `packages/contracts/src/notifications.ts`:

```typescript
import { z } from 'zod';

const notificationChannelSchema = z.enum(['sms', 'email', 'slack', 'web']);
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

export const updateNotificationPreferencesInputSchema = z.object({
  category: z.string().min(1),
  channels: z.array(notificationChannelSchema).min(1),
  quietHours: z.object({
    timezone: z.string().min(1),
    startHour: z.number().int().min(0).max(24),
    endHour: z.number().int().min(0).max(24),
  }).nullable().optional(),
});
export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesInputSchema>;
```

- [ ] **Step 2: Add new permissions to auth.ts**

In `packages/contracts/src/auth.ts`, add to the permissions enum:

```typescript
'journeys.read',
'journeys.write',
'conversations.read',
'conversations.write',
'upsells.read',
'upsells.write',
'notifications.read',
'notifications.write',
```

Also update `ROLE_PERMISSIONS` so that `owner` role has all of these.

- [ ] **Step 3: Export from index**

Add to `packages/contracts/src/index.ts`:

```typescript
export * from './notifications.js';
```

- [ ] **Step 4: Run typecheck**

Run: `cd packages/contracts && pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/notifications.ts packages/contracts/src/auth.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): add notification schemas and journey permissions"
```

---

## Task 2: Database Schema — Journey Tables

**Files:**
- Modify: `packages/db/src/schema.ts`

Add all 8 new tables from the spec. No migration file needed yet — we'll generate it after all tables are defined.

- [ ] **Step 1: Add journey tables to schema.ts**

Add at the end of `packages/db/src/schema.ts` (before closing):

```typescript
// ─── Journey Engine ───────────────────────────────────────────

export const journeys = waltSchema.table(
  'journeys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    status: text('status').notNull().default('draft'), // draft | active | paused | archived
    propertyIds: text('property_ids').array().notNull().default([]),
    triggerType: text('trigger_type').notNull(),
    triggerConfig: jsonb('trigger_config').notNull().default({}),
    steps: jsonb('steps').$type<import('@walt/contracts').JourneyStep[]>().notNull(),
    coverageSchedule: jsonb('coverage_schedule'),
    approvalMode: text('approval_mode').notNull().default('draft'), // draft | auto_with_exceptions | autonomous
    version: integer('version').notNull().default(1),
    prompt: text('prompt').notNull(),
    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('journeys_organization_id_idx').on(t.organizationId),
    index('journeys_status_idx').on(t.organizationId, t.status),
  ],
);

export const journeyEnrollments = waltSchema.table(
  'journey_enrollments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    journeyId: uuid('journey_id').notNull().references(() => journeys.id),
    reservationId: text('reservation_id').notNull(),
    organizationId: text('organization_id').notNull(),
    currentStepIndex: integer('current_step_index').notNull().default(0),
    journeyVersion: integer('journey_version').notNull(),
    status: text('status').notNull().default('active'), // active | completed | cancelled | paused
    nextExecutionAt: timestamp('next_execution_at', { withTimezone: true }),
    retryCount: integer('retry_count').notNull().default(0),
    context: jsonb('context').notNull().default({}),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('journey_enrollments_unique_idx').on(t.journeyId, t.reservationId),
    index('journey_enrollments_pending_idx')
      .on(t.nextExecutionAt)
      .where(sql`status = 'active'`),
    index('journey_enrollments_organization_id_idx').on(t.organizationId),
  ],
);

export const journeyExclusions = waltSchema.table(
  'journey_exclusions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    journeyId: uuid('journey_id').notNull().references(() => journeys.id),
    reservationId: text('reservation_id').notNull(),
    organizationId: text('organization_id').notNull(),
    excludedBy: text('excluded_by').notNull(),
    excludedAt: timestamp('excluded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('journey_exclusions_unique_idx').on(t.journeyId, t.reservationId),
  ],
);

export const journeyExecutionLog = waltSchema.table(
  'journey_execution_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enrollmentId: uuid('enrollment_id').notNull().references(() => journeyEnrollments.id),
    journeyId: uuid('journey_id').notNull().references(() => journeys.id),
    organizationId: text('organization_id').notNull(),
    reservationId: text('reservation_id').notNull(),
    stepIndex: integer('step_index').notNull(),
    action: text('action').notNull(), // message_drafted | message_sent | task_created | notification_sent | ai_decision | skipped | escalated | failed
    input: jsonb('input'),
    output: jsonb('output'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('journey_execution_log_enrollment_idx').on(t.enrollmentId, t.createdAt),
    index('journey_execution_log_rate_limit_idx').on(t.reservationId, t.action, t.createdAt),
  ],
);

export const conversationSettings = waltSchema.table(
  'conversation_settings',
  {
    reservationId: text('reservation_id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    aiStatus: text('ai_status').notNull().default('active'), // active | paused
    aiPausedUntil: timestamp('ai_paused_until', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

export const upsellEvents = waltSchema.table(
  'upsell_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id').notNull(),
    propertyId: text('property_id').notNull(),
    reservationId: text('reservation_id').notNull(),
    journeyId: uuid('journey_id').references(() => journeys.id),
    enrollmentId: uuid('enrollment_id').references(() => journeyEnrollments.id),
    upsellType: text('upsell_type').notNull(), // gap_night | early_checkin | late_checkout | stay_extension | custom
    status: text('status').notNull().default('offered'), // offered | accepted | declined | expired
    messageId: text('message_id'),
    offeredAt: timestamp('offered_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    estimatedRevenue: integer('estimated_revenue'),
    actualRevenue: integer('actual_revenue'),
  },
  (t) => [
    index('upsell_events_org_property_idx').on(t.organizationId, t.propertyId, t.status),
  ],
);

export const notificationPreferences = waltSchema.table(
  'notification_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id').notNull(),
    memberId: text('member_id'),
    category: text('category').notNull(), // escalation | upsell | task | journey | system
    channels: text('channels').array().notNull(),
    quietHours: jsonb('quiet_hours'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('notification_preferences_org_idx').on(t.organizationId),
    uniqueIndex('notification_preferences_unique_idx').on(t.organizationId, t.memberId, t.category),
  ],
);

export const notifications = waltSchema.table(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id').notNull(),
    recipientId: text('recipient_id').notNull(),
    category: text('category').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    metadata: jsonb('metadata'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('notifications_unread_idx')
      .on(t.organizationId, t.recipientId)
      .where(sql`read_at IS NULL`),
  ],
);
```

- [ ] **Step 2: Run typecheck**

Run: `cd packages/db && pnpm typecheck`
Expected: PASS (no type errors)

- [ ] **Step 3: Generate migration**

Run: `cd packages/db && npx drizzle-kit generate`
Expected: Creates a new migration file `drizzle/00XX_*.sql` with all 8 tables

- [ ] **Step 4: Review the generated migration**

Read the generated SQL file to verify:
- All 8 tables created in `walt` schema
- Indexes and unique constraints present
- Foreign keys reference correct tables
- No snapshot JSON files included (per CLAUDE.md)

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/
git commit -m "feat(db): add journey engine tables, enrollment, execution log, upsells, notifications"
```

---

## Task 3: @walt/sms Package

**Files:**
- Create: `packages/sms/package.json`
- Create: `packages/sms/tsconfig.json`
- Create: `packages/sms/src/index.ts`
- Create: `packages/sms/src/client.ts`
- Create: `packages/sms/src/client.test.ts`

- [ ] **Step 1: Write tests for SmsSender**

Create `packages/sms/src/client.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';

import { TwilioSmsSender } from './client';

void test('TwilioSmsSender.send calls twilio with correct params', async () => {
  let capturedArgs: { to: string; from: string; body: string } | undefined;

  const mockTwilio = {
    messages: {
      create: async (args: { to: string; from: string; body: string }) => {
        capturedArgs = args;
        return { sid: 'SM123' };
      },
    },
  };

  const sender = new TwilioSmsSender({
    client: mockTwilio as never,
    fromNumber: '+15551234567',
  });

  await sender.send('+15559876543', 'Hello guest');

  assert.deepEqual(capturedArgs, {
    to: '+15559876543',
    from: '+15551234567',
    body: 'Hello guest',
  });
});

void test('TwilioSmsSender.send throws on failure', async () => {
  const mockTwilio = {
    messages: {
      create: async () => { throw new Error('Network error'); },
    },
  };

  const sender = new TwilioSmsSender({
    client: mockTwilio as never,
    fromNumber: '+15551234567',
  });

  await assert.rejects(() => sender.send('+15559876543', 'Hello'), /Network error/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/sms && npx tsx --test src/client.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create package scaffolding**

Create `packages/sms/package.json`:

```json
{
  "name": "@walt/sms",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "twilio": "^5.0.0"
  }
}
```

Create `packages/sms/tsconfig.json`:

```json
{
  "extends": "../config-typescript/base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 4: Write SmsSender implementation**

Create `packages/sms/src/client.ts`:

```typescript
export interface SmsSender {
  send(to: string, body: string): Promise<void>;
}

type TwilioClient = {
  messages: {
    create(params: { to: string; from: string; body: string }): Promise<{ sid: string }>;
  };
};

export class TwilioSmsSender implements SmsSender {
  private client: TwilioClient;
  private fromNumber: string;

  constructor(opts: { client: TwilioClient; fromNumber: string }) {
    this.client = opts.client;
    this.fromNumber = opts.fromNumber;
  }

  async send(to: string, body: string): Promise<void> {
    await this.client.messages.create({ to, from: this.fromNumber, body });
  }
}
```

Create `packages/sms/src/index.ts`:

```typescript
export { SmsSender, TwilioSmsSender } from './client';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/sms && npx tsx --test src/client.test.ts`
Expected: All 2 tests PASS

- [ ] **Step 6: Run pnpm install to register the package**

Run: `pnpm install`

- [ ] **Step 7: Commit**

```bash
git add packages/sms/
git commit -m "feat: add @walt/sms package with provider-agnostic interface"
```

---

## Task 4: @walt/email Package

**Files:**
- Create: `packages/email/package.json`
- Create: `packages/email/tsconfig.json`
- Create: `packages/email/src/index.ts`
- Create: `packages/email/src/client.ts`
- Create: `packages/email/src/client.test.ts`

Same pattern as @walt/sms. Provider-agnostic `EmailSender` interface with `ResendEmailSender` implementation.

- [ ] **Step 1: Write tests for EmailSender**

Create `packages/email/src/client.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';

import { ResendEmailSender } from './client';

void test('ResendEmailSender.send calls resend with correct params', async () => {
  let capturedArgs: Record<string, unknown> | undefined;

  const mockResend = {
    emails: {
      send: async (args: Record<string, unknown>) => {
        capturedArgs = args;
        return { id: 'email-123' };
      },
    },
  };

  const sender = new ResendEmailSender({
    client: mockResend as never,
    fromAddress: 'walt@notifications.walt.ai',
  });

  await sender.send({
    to: 'host@example.com',
    subject: 'Reminder',
    text: 'Your guest is arriving tomorrow',
  });

  assert.equal(capturedArgs?.to, 'host@example.com');
  assert.equal(capturedArgs?.subject, 'Reminder');
  assert.equal(capturedArgs?.from, 'walt@notifications.walt.ai');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/email && npx tsx --test src/client.test.ts`
Expected: FAIL

- [ ] **Step 3: Create package scaffolding**

Create `packages/email/package.json`:

```json
{
  "name": "@walt/email",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "resend": "^4.0.0"
  }
}
```

Create `packages/email/tsconfig.json`:

```json
{
  "extends": "../config-typescript/base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 4: Write EmailSender implementation**

Create `packages/email/src/client.ts`:

```typescript
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

type ResendClient = {
  emails: {
    send(params: Record<string, unknown>): Promise<{ id: string }>;
  };
};

export class ResendEmailSender implements EmailSender {
  private client: ResendClient;
  private fromAddress: string;

  constructor(opts: { client: ResendClient; fromAddress: string }) {
    this.client = opts.client;
    this.fromAddress = opts.fromAddress;
  }

  async send(message: EmailMessage): Promise<void> {
    await this.client.emails.send({
      from: this.fromAddress,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
```

Create `packages/email/src/index.ts`:

```typescript
export { EmailSender, EmailMessage, ResendEmailSender } from './client';
```

- [ ] **Step 5: Run tests, pnpm install, commit**

Run: `cd packages/email && npx tsx --test src/client.test.ts`
Expected: PASS

Run: `pnpm install`

```bash
git add packages/email/
git commit -m "feat: add @walt/email package with provider-agnostic interface"
```

---

## Task 5: @walt/slack Package

**Files:**
- Create: `packages/slack/package.json`
- Create: `packages/slack/tsconfig.json`
- Create: `packages/slack/src/index.ts`
- Create: `packages/slack/src/client.ts`
- Create: `packages/slack/src/client.test.ts`

- [ ] **Step 1: Write tests for SlackClient**

Create `packages/slack/src/client.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';

import { SlackClient } from './client';

void test('SlackClient.postMessage sends to correct channel', async () => {
  let capturedBody: Record<string, unknown> | undefined;

  const mockFetch = async (_url: string, opts: { body: string }) => {
    capturedBody = JSON.parse(opts.body) as Record<string, unknown>;
    return { ok: true, json: async () => ({ ok: true }) } as Response;
  };

  const client = new SlackClient({ token: 'xoxb-test', fetch: mockFetch as never });

  await client.postMessage('#urgent', 'Guest complaint at Beach House');

  assert.equal(capturedBody?.channel, '#urgent');
  assert.equal(capturedBody?.text, 'Guest complaint at Beach House');
});

void test('SlackClient.postMessage throws on Slack API error', async () => {
  const mockFetch = async () =>
    ({ ok: true, json: async () => ({ ok: false, error: 'channel_not_found' }) }) as Response;

  const client = new SlackClient({ token: 'xoxb-test', fetch: mockFetch as never });

  await assert.rejects(
    () => client.postMessage('#nonexistent', 'test'),
    /channel_not_found/,
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/slack && npx tsx --test src/client.test.ts`
Expected: FAIL

- [ ] **Step 3: Create package scaffolding + implementation**

Create `packages/slack/package.json`:

```json
{
  "name": "@walt/slack",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

Create `packages/slack/tsconfig.json`:

```json
{
  "extends": "../config-typescript/base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

Create `packages/slack/src/client.ts`:

```typescript
type SlackResponse = { ok: boolean; error?: string };

export class SlackClient {
  private token: string;
  private fetch: typeof globalThis.fetch;

  constructor(opts: { token: string; fetch?: typeof globalThis.fetch }) {
    this.token = opts.token;
    this.fetch = opts.fetch ?? globalThis.fetch;
  }

  async postMessage(channel: string, text: string): Promise<void> {
    const response = await this.fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel, text }),
    });

    const data = (await response.json()) as SlackResponse;
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error ?? 'unknown'}`);
    }
  }
}
```

Create `packages/slack/src/index.ts`:

```typescript
export { SlackClient } from './client';
```

- [ ] **Step 4: Run tests, pnpm install, commit**

Run: `cd packages/slack && npx tsx --test src/client.test.ts`
Expected: PASS

Run: `pnpm install`

```bash
git add packages/slack/
git commit -m "feat: add @walt/slack package"
```

---

## Task 6: @walt/notifications Package

**Files:**
- Create: `packages/notifications/package.json`
- Create: `packages/notifications/tsconfig.json`
- Create: `packages/notifications/src/index.ts`
- Create: `packages/notifications/src/types.ts`
- Create: `packages/notifications/src/router.ts`
- Create: `packages/notifications/src/router.test.ts`

- [ ] **Step 1: Write tests for NotificationRouter**

Create `packages/notifications/src/router.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';

import type { SmsSender } from '@walt/sms';
import type { EmailSender } from '@walt/email';
import type { SlackClient } from '@walt/slack';

import { NotificationRouter } from './router';
import type { Notification, NotificationPreference } from './types';

function createMockRouter(overrides: {
  sms?: SmsSender;
  email?: EmailSender;
  slack?: SlackClient;
  getPreferences?: (orgId: string, category: string) => Promise<NotificationPreference | null>;
  getRecipientContact?: (orgId: string, recipientId?: string) => Promise<{ phone?: string; email?: string }>;
  persistWebNotification?: (notification: Notification) => Promise<void>;
}) {
  return new NotificationRouter({
    sms: overrides.sms ?? { send: async () => {} },
    email: overrides.email ?? { send: async () => {} },
    slack: overrides.slack ?? { postMessage: async () => {} },
    getPreferences: overrides.getPreferences ?? (async () => null),
    getRecipientContact: overrides.getRecipientContact ?? (async () => ({ phone: '+15551234567', email: 'host@test.com' })),
    persistWebNotification: overrides.persistWebNotification ?? (async () => {}),
  });
}

void test('NotificationRouter sends SMS when channel includes sms', async () => {
  let smsSent = false;
  const router = createMockRouter({
    sms: { send: async () => { smsSent = true; } },
  });

  await router.send({
    organizationId: 'org-1',
    channels: ['sms'],
    category: 'escalation',
    title: 'Urgent',
    body: 'Guest locked out',
    urgency: 'high',
  });

  assert.equal(smsSent, true);
});

void test('NotificationRouter sends to multiple channels in parallel', async () => {
  const sent: string[] = [];
  const router = createMockRouter({
    sms: { send: async () => { sent.push('sms'); } },
    email: { send: async () => { sent.push('email'); } },
  });

  await router.send({
    organizationId: 'org-1',
    channels: ['sms', 'email'],
    category: 'task',
    title: 'Task Due',
    body: 'Prepare welcome package',
    urgency: 'normal',
  });

  assert.deepEqual(sent.sort(), ['email', 'sms']);
});

void test('NotificationRouter always persists web notification', async () => {
  let persisted = false;
  const router = createMockRouter({
    persistWebNotification: async () => { persisted = true; },
  });

  await router.send({
    organizationId: 'org-1',
    channels: ['web'],
    category: 'system',
    title: 'Info',
    body: 'Journey completed',
    urgency: 'low',
  });

  assert.equal(persisted, true);
});

void test('NotificationRouter skips SMS if no phone number', async () => {
  let smsSent = false;
  const router = createMockRouter({
    sms: { send: async () => { smsSent = true; } },
    getRecipientContact: async () => ({ email: 'host@test.com' }),
  });

  await router.send({
    organizationId: 'org-1',
    channels: ['sms'],
    category: 'escalation',
    title: 'Alert',
    body: 'Issue detected',
    urgency: 'high',
  });

  assert.equal(smsSent, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/notifications && npx tsx --test src/router.test.ts`
Expected: FAIL

- [ ] **Step 3: Create package scaffolding**

Create `packages/notifications/package.json`:

```json
{
  "name": "@walt/notifications",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@walt/sms": "workspace:*",
    "@walt/email": "workspace:*",
    "@walt/slack": "workspace:*"
  }
}
```

Create `packages/notifications/tsconfig.json`:

```json
{
  "extends": "../config-typescript/base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 4: Write types**

Create `packages/notifications/src/types.ts`:

```typescript
export type NotificationChannel = 'sms' | 'email' | 'slack' | 'web';

export interface Notification {
  organizationId: string;
  recipientId?: string;
  channels: NotificationChannel[];
  category: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  urgency: 'low' | 'normal' | 'high';
}

export interface NotificationPreference {
  channels: NotificationChannel[];
  quietHours?: { timezone: string; startHour: number; endHour: number } | null;
}
```

- [ ] **Step 5: Write NotificationRouter**

Create `packages/notifications/src/router.ts`:

```typescript
import type { SmsSender } from '@walt/sms';
import type { EmailSender } from '@walt/email';
import type { SlackClient } from '@walt/slack';

import type { Notification, NotificationPreference } from './types';

export type NotificationRouterDeps = {
  sms: SmsSender;
  email: EmailSender;
  slack: SlackClient;
  getPreferences: (orgId: string, category: string) => Promise<NotificationPreference | null>;
  getRecipientContact: (orgId: string, recipientId?: string) => Promise<{ phone?: string; email?: string }>;
  persistWebNotification: (notification: Notification) => Promise<void>;
};

export class NotificationRouter {
  private deps: NotificationRouterDeps;

  constructor(deps: NotificationRouterDeps) {
    this.deps = deps;
  }

  async send(notification: Notification): Promise<void> {
    const contact = await this.deps.getRecipientContact(
      notification.organizationId,
      notification.recipientId,
    );

    const sends: Promise<void>[] = [];

    for (const channel of notification.channels) {
      switch (channel) {
        case 'sms':
          if (contact.phone) {
            sends.push(
              this.deps.sms.send(contact.phone, `[Hostpilot] ${notification.title}: ${notification.body}`),
            );
          }
          break;
        case 'email':
          if (contact.email) {
            sends.push(
              this.deps.email.send({
                to: contact.email,
                subject: `[Hostpilot] ${notification.title}`,
                text: notification.body,
              }),
            );
          }
          break;
        case 'slack':
          sends.push(
            this.deps.slack.postMessage(notification.category, notification.body),
          );
          break;
        case 'web':
          sends.push(this.deps.persistWebNotification(notification));
          break;
      }
    }

    await Promise.allSettled(sends);
  }
}
```

Create `packages/notifications/src/index.ts`:

```typescript
export { NotificationRouter } from './router';
export type { NotificationRouterDeps } from './router';
export type { Notification, NotificationChannel, NotificationPreference } from './types';
```

- [ ] **Step 6: Run tests, pnpm install, commit**

Run: `cd packages/notifications && npx tsx --test src/router.test.ts`
Expected: All 4 tests PASS

Run: `pnpm install`

```bash
git add packages/notifications/
git commit -m "feat: add @walt/notifications package with multi-channel routing"
```

---

## Task 7: Coverage Schedule Evaluator

**Files:**
- Create: `apps/web/src/lib/journeys/coverage.ts`
- Create: `apps/web/src/lib/journeys/coverage.test.ts`

Pure utility — no DB or API dependencies. Tests are straightforward.

- [ ] **Step 1: Write tests**

Create `apps/web/src/lib/journeys/coverage.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';

import { isWithinCoverageWindow, getNextWindowStart } from './coverage';
import type { CoverageSchedule } from '@walt/contracts';

const weekdaySchedule: CoverageSchedule = {
  timezone: 'America/New_York',
  windows: [
    { days: ['mon', 'tue', 'wed', 'thu', 'fri'], startHour: 9, endHour: 22 },
  ],
};

const alwaysOnSchedule: CoverageSchedule = {
  timezone: 'UTC',
  windows: [
    { days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], startHour: 0, endHour: 24 },
  ],
};

void test('isWithinCoverageWindow returns true for null schedule (always active)', () => {
  assert.equal(isWithinCoverageWindow(null, new Date()), true);
});

void test('isWithinCoverageWindow returns true within window', () => {
  // Wednesday 2pm ET = 6pm UTC (during EST)
  const wed2pmET = new Date('2026-03-25T18:00:00Z');
  assert.equal(isWithinCoverageWindow(weekdaySchedule, wed2pmET), true);
});

void test('isWithinCoverageWindow returns false outside window hours', () => {
  // Wednesday 2am ET = 6am UTC
  const wed2amET = new Date('2026-03-25T06:00:00Z');
  assert.equal(isWithinCoverageWindow(weekdaySchedule, wed2amET), false);
});

void test('isWithinCoverageWindow returns false on weekend for weekday-only schedule', () => {
  // Saturday 2pm ET
  const sat2pmET = new Date('2026-03-28T18:00:00Z');
  assert.equal(isWithinCoverageWindow(weekdaySchedule, sat2pmET), false);
});

void test('getNextWindowStart returns next Monday 9am for weekend', () => {
  // Saturday 2pm ET = 6pm UTC
  const sat2pmET = new Date('2026-03-28T18:00:00Z');
  const next = getNextWindowStart(weekdaySchedule, sat2pmET);
  assert.ok(next);
  // Next Monday 9am ET = 1pm UTC (during EDT which starts March 8)
  assert.equal(next.getUTCDay(), 1); // Monday
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx tsx --test src/lib/journeys/coverage.test.ts`
Expected: FAIL

- [ ] **Step 3: Write coverage evaluator**

Create `apps/web/src/lib/journeys/coverage.ts`:

```typescript
import type { CoverageSchedule } from '@walt/contracts';

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function getLocalTime(date: Date, timezone: string): { dayName: string; hour: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value?.toLowerCase().slice(0, 3) ?? '';
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  return { dayName: weekday, hour };
}

export function isWithinCoverageWindow(
  schedule: CoverageSchedule | null,
  now: Date,
): boolean {
  if (!schedule) return true;

  const { dayName, hour } = getLocalTime(now, schedule.timezone);

  return schedule.windows.some(
    (window) =>
      window.days.includes(dayName as (typeof DAY_NAMES)[number]) &&
      hour >= window.startHour &&
      hour < window.endHour,
  );
}

export function getNextWindowStart(
  schedule: CoverageSchedule,
  now: Date,
): Date {
  // Walk forward hour by hour up to 7 days to find the next open window
  const candidate = new Date(now);
  candidate.setMinutes(0, 0, 0);

  for (let i = 0; i < 168; i++) {
    candidate.setTime(candidate.getTime() + 60 * 60 * 1000);
    if (isWithinCoverageWindow(schedule, candidate)) {
      return candidate;
    }
  }

  // Fallback: return 24 hours from now
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx tsx --test src/lib/journeys/coverage.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/journeys/
git commit -m "feat: add coverage schedule evaluator for journey engine"
```

---

## Task 8: Journey Message Generator

**Files:**
- Create: `apps/web/src/lib/journeys/generate-journey-message.ts`
- Create: `apps/web/src/lib/journeys/generate-journey-message.test.ts`

Adapted from `generate-reply-suggestion.ts` — accepts a `directive` string instead of chips.

**IMPORTANT:** Do NOT copy the direct `new OpenAI()` import pattern from `generate-reply-suggestion.ts`. That file violates the `@walt/*` package architecture convention. This implementation uses dependency injection (`callAI` dep) so the actual OpenAI call is wired up in the cron handler, not embedded in the library function. The real `callAI` implementation should use `@walt/ai` or be passed in from the handler.

- [ ] **Step 1: Write tests**

Create `apps/web/src/lib/journeys/generate-journey-message.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';

import { generateJourneyMessage } from './generate-journey-message';

void test('generateJourneyMessage returns suggestion with sources', async () => {
  const result = await generateJourneyMessage(
    {
      directive: 'Thank the guest for booking and confirm check-in time',
      guestFirstName: 'John',
      propertyName: 'Beach House',
      propertyId: 'prop-1',
      organizationId: 'org-1',
      checkIn: new Date('2026-04-01'),
      checkOut: new Date('2026-04-05'),
      conversationHistory: [],
    },
    {
      resolveKnowledge: async () => [],
      resolvePropertyFacts: async () => 'Check-in: 4pm. WiFi: BeachHouse2026.',
      resolveAgentConfig: async () => ({
        tone: 'friendly',
        emojiUse: 'minimal',
        responseLength: 'shorter',
        specialInstructions: null,
      }),
      callAI: async (messages) => {
        assert.ok(messages[0].content.includes('Thank the guest for booking'));
        return 'Hi John! Thanks for booking Beach House. Check-in is at 4pm.';
      },
    },
  );

  assert.ok(result);
  assert.ok(result.suggestion.includes('John'));
});

void test('generateJourneyMessage returns null when AI fails', async () => {
  const result = await generateJourneyMessage(
    {
      directive: 'Send check-in instructions',
      guestFirstName: 'Jane',
      propertyName: 'Mountain Cabin',
      propertyId: 'prop-2',
      organizationId: 'org-1',
      checkIn: new Date('2026-04-01'),
      checkOut: new Date('2026-04-03'),
      conversationHistory: [],
    },
    {
      resolveKnowledge: async () => [],
      resolvePropertyFacts: async () => '',
      resolveAgentConfig: async () => ({
        tone: 'formal',
        emojiUse: 'no_emoji',
        responseLength: 'more_detail',
        specialInstructions: null,
      }),
      callAI: async () => null,
    },
  );

  assert.equal(result, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx tsx --test src/lib/journeys/generate-journey-message.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the journey message generator**

Create `apps/web/src/lib/journeys/generate-journey-message.ts`:

```typescript
import { SYSTEM_RULES } from '@/lib/ai/system-rules';

type AgentConfig = {
  tone: string | null;
  emojiUse: string | null;
  responseLength: string | null;
  specialInstructions: string | null;
};

type KnowledgeEntry = {
  id: string;
  label: string;
  snippet: string;
};

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type GenerateJourneyMessageInput = {
  directive: string;
  guestFirstName: string | null;
  propertyName: string;
  propertyId: string | null;
  organizationId: string;
  checkIn: Date | null;
  checkOut: Date | null;
  conversationHistory: Array<{ body: string | null; senderType: string | null }>;
};

export type GenerateJourneyMessageDeps = {
  resolveKnowledge: (orgId: string, propertyId: string | null) => Promise<KnowledgeEntry[]>;
  resolvePropertyFacts: (propertyId: string | null) => Promise<string>;
  resolveAgentConfig: (orgId: string, propertyId: string | null) => Promise<AgentConfig>;
  callAI: (messages: ChatMessage[]) => Promise<string | null>;
};

export type JourneyMessageResult = {
  suggestion: string;
  sourcesUsed: Array<{ type: string; id: string; label: string; snippet?: string }>;
};

export async function generateJourneyMessage(
  input: GenerateJourneyMessageInput,
  deps: GenerateJourneyMessageDeps,
): Promise<JourneyMessageResult | null> {
  const [knowledge, facts, config] = await Promise.all([
    deps.resolveKnowledge(input.organizationId, input.propertyId),
    deps.resolvePropertyFacts(input.propertyId),
    deps.resolveAgentConfig(input.organizationId, input.propertyId),
  ]);

  const today = new Date().toISOString().split('T')[0];
  const checkInStr = input.checkIn?.toISOString().split('T')[0] ?? 'unknown';
  const checkOutStr = input.checkOut?.toISOString().split('T')[0] ?? 'unknown';

  let phase = 'pre-arrival';
  if (input.checkIn && input.checkOut) {
    const now = new Date();
    if (now >= input.checkOut) phase = 'post-checkout';
    else if (now >= input.checkIn) phase = 'during-stay';
  }

  const knowledgeContext = knowledge.length > 0
    ? knowledge.map((k) => `- ${k.label}: ${k.snippet}`).join('\n')
    : 'No specific knowledge entries available.';

  const systemPrompt = [
    `You are a short-term rental host assistant for "${input.propertyName}".`,
    `Today: ${today}. Guest: ${input.guestFirstName ?? 'Guest'}. Check-in: ${checkInStr}. Check-out: ${checkOutStr}. Phase: ${phase}.`,
    config.tone ? `Tone: ${config.tone}.` : '',
    config.emojiUse ? `Emoji use: ${config.emojiUse}.` : '',
    config.responseLength ? `Response length: ${config.responseLength}.` : '',
    config.specialInstructions ? `Special instructions: ${config.specialInstructions}` : '',
    '',
    SYSTEM_RULES,
    '',
    '--- Property Facts ---',
    facts || 'No property facts available.',
    '',
    '--- Knowledge Base ---',
    knowledgeContext,
    '',
    '--- Your Task ---',
    `DIRECTIVE: ${input.directive}`,
    'Write a message to the guest following this directive. Use the property facts and knowledge base to include accurate details. Do not invent information that is not in the facts or knowledge base.',
  ].filter(Boolean).join('\n');

  const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

  for (const msg of input.conversationHistory) {
    if (msg.body) {
      messages.push({
        role: msg.senderType === 'guest' ? 'user' : 'assistant',
        content: msg.body,
      });
    }
  }

  const suggestion = await deps.callAI(messages);
  if (!suggestion) return null;

  const sourcesUsed = knowledge.map((k) => ({
    type: 'knowledge_entry',
    id: k.id,
    label: k.label,
    snippet: k.snippet,
  }));

  return { suggestion, sourcesUsed };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx tsx --test src/lib/journeys/generate-journey-message.test.ts`
Expected: All 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/journeys/generate-journey-message.ts apps/web/src/lib/journeys/generate-journey-message.test.ts
git commit -m "feat: add journey message generator adapted from reply suggestion pipeline"
```

---

## Task 9: Journey Executor Core

**Files:**
- Create: `apps/web/src/lib/journeys/executor.ts`
- Create: `apps/web/src/lib/journeys/executor.test.ts`

The executor processes one enrollment at a time. The cron handler (Task 12) calls this for each due enrollment.

- [ ] **Step 1: Write tests for the executor**

Create `apps/web/src/lib/journeys/executor.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';

import { executeStep } from './executor';
import type { JourneyStep } from '@walt/contracts';

void test('executeStep send_message creates draft and returns message_drafted', async () => {
  const step: JourneyStep = { type: 'send_message', directive: 'Welcome the guest' };
  let draftCreated = false;

  const result = await executeStep(step, {
    enrollment: {
      id: 'enr-1', journeyId: 'j-1', reservationId: 'res-1',
      organizationId: 'org-1', context: {},
    },
    approvalMode: 'draft',
    deps: {
      generateMessage: async () => ({ suggestion: 'Welcome!', sourcesUsed: [] }),
      createDraft: async () => { draftCreated = true; },
      sendMessage: async () => {},
      createTask: async () => {},
      sendNotification: async () => {},
      checkAiStatus: async () => 'active',
      checkRateLimit: async () => false,
      getCalendarData: async () => ({ nightBeforeFree: true, nightAfterFree: false }),
      makeAiDecision: async () => ({ decision: true, reasoning: '' }),
      setAiStatus: async () => {},
    },
  });

  assert.equal(result.action, 'message_drafted');
  assert.equal(draftCreated, true);
});

void test('executeStep send_message defers when AI is paused', async () => {
  const step: JourneyStep = { type: 'send_message', directive: 'Check-in info' };

  const result = await executeStep(step, {
    enrollment: {
      id: 'enr-1', journeyId: 'j-1', reservationId: 'res-1',
      organizationId: 'org-1', context: {},
    },
    approvalMode: 'draft',
    deps: {
      generateMessage: async () => ({ suggestion: 'Info!', sourcesUsed: [] }),
      createDraft: async () => {},
      sendMessage: async () => {},
      createTask: async () => {},
      sendNotification: async () => {},
      checkAiStatus: async () => 'paused',
      checkRateLimit: async () => false,
      getCalendarData: async () => ({ nightBeforeFree: false, nightAfterFree: false }),
      makeAiDecision: async () => ({ decision: true, reasoning: '' }),
      setAiStatus: async () => {},
    },
  });

  assert.equal(result.action, 'skipped');
  assert.equal(result.deferred, true);
});

void test('executeStep wait calculates next execution time', async () => {
  const step: JourneyStep = { type: 'wait', directive: { delayMinutes: 30 } };

  const result = await executeStep(step, {
    enrollment: {
      id: 'enr-1', journeyId: 'j-1', reservationId: 'res-1',
      organizationId: 'org-1', context: {},
    },
    approvalMode: 'draft',
    deps: {
      generateMessage: async () => null,
      createDraft: async () => {},
      sendMessage: async () => {},
      createTask: async () => {},
      sendNotification: async () => {},
      checkAiStatus: async () => 'active',
      checkRateLimit: async () => false,
      getCalendarData: async () => ({ nightBeforeFree: false, nightAfterFree: false }),
      makeAiDecision: async () => ({ decision: true, reasoning: '' }),
      setAiStatus: async () => {},
    },
  });

  assert.equal(result.action, 'skipped');
  assert.ok(result.nextExecutionAt);
  const diffMs = result.nextExecutionAt.getTime() - Date.now();
  assert.ok(diffMs > 25 * 60 * 1000 && diffMs < 35 * 60 * 1000);
});

void test('executeStep ai_decision advances or skips based on AI response', async () => {
  const step: JourneyStep = {
    type: 'ai_decision',
    directive: 'Is the night before free?',
    skipToStep: 5,
  };

  const resultTrue = await executeStep(step, {
    enrollment: {
      id: 'enr-1', journeyId: 'j-1', reservationId: 'res-1',
      organizationId: 'org-1', context: {},
    },
    approvalMode: 'draft',
    deps: {
      generateMessage: async () => null,
      createDraft: async () => {},
      sendMessage: async () => {},
      createTask: async () => {},
      sendNotification: async () => {},
      checkAiStatus: async () => 'active',
      checkRateLimit: async () => false,
      getCalendarData: async () => ({ nightBeforeFree: true, nightAfterFree: false }),
      makeAiDecision: async () => ({ decision: true, reasoning: 'Night before is available' }),
      setAiStatus: async () => {},
    },
  });

  assert.equal(resultTrue.action, 'ai_decision');
  assert.equal(resultTrue.skipToStep, undefined);

  const resultFalse = await executeStep(step, {
    enrollment: {
      id: 'enr-1', journeyId: 'j-1', reservationId: 'res-1',
      organizationId: 'org-1', context: {},
    },
    approvalMode: 'draft',
    deps: {
      generateMessage: async () => null,
      createDraft: async () => {},
      sendMessage: async () => {},
      createTask: async () => {},
      sendNotification: async () => {},
      checkAiStatus: async () => 'active',
      checkRateLimit: async () => false,
      getCalendarData: async () => ({ nightBeforeFree: false, nightAfterFree: false }),
      makeAiDecision: async () => ({ decision: false, reasoning: 'Night before is booked' }),
      setAiStatus: async () => {},
    },
  });

  assert.equal(resultFalse.action, 'ai_decision');
  assert.equal(resultFalse.skipToStep, 5);
});

void test('executeStep create_task calls createTask dep', async () => {
  const step: JourneyStep = {
    type: 'create_task',
    directive: { title: 'Prepare welcome package', priority: 'medium' },
  };
  let taskCreated = false;

  const result = await executeStep(step, {
    enrollment: {
      id: 'enr-1', journeyId: 'j-1', reservationId: 'res-1',
      organizationId: 'org-1', context: {},
    },
    approvalMode: 'draft',
    deps: {
      generateMessage: async () => null,
      createDraft: async () => {},
      sendMessage: async () => {},
      createTask: async () => { taskCreated = true; },
      sendNotification: async () => {},
      checkAiStatus: async () => 'active',
      checkRateLimit: async () => false,
      getCalendarData: async () => ({ nightBeforeFree: false, nightAfterFree: false }),
      makeAiDecision: async () => ({ decision: true, reasoning: '' }),
      setAiStatus: async () => {},
    },
  });

  assert.equal(result.action, 'task_created');
  assert.equal(taskCreated, true);
});

void test('executeStep send_message skipped when rate limited', async () => {
  const step: JourneyStep = { type: 'send_message', directive: 'Follow up' };

  const result = await executeStep(step, {
    enrollment: {
      id: 'enr-1', journeyId: 'j-1', reservationId: 'res-1',
      organizationId: 'org-1', context: {},
    },
    approvalMode: 'draft',
    deps: {
      generateMessage: async () => ({ suggestion: 'Hi!', sourcesUsed: [] }),
      createDraft: async () => {},
      sendMessage: async () => {},
      createTask: async () => {},
      sendNotification: async () => {},
      checkAiStatus: async () => 'active',
      checkRateLimit: async () => true,
      getCalendarData: async () => ({ nightBeforeFree: false, nightAfterFree: false }),
      makeAiDecision: async () => ({ decision: true, reasoning: '' }),
      setAiStatus: async () => {},
    },
  });

  assert.equal(result.action, 'skipped');
  assert.equal(result.deferred, true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx tsx --test src/lib/journeys/executor.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the executor**

Create `apps/web/src/lib/journeys/executor.ts`:

```typescript
import type { JourneyStep, ApprovalMode } from '@walt/contracts';

type EnrollmentContext = {
  id: string;
  journeyId: string;
  reservationId: string;
  organizationId: string;
  context: Record<string, unknown>;
};

type CalendarData = {
  nightBeforeFree: boolean;
  nightAfterFree: boolean;
};

type AiDecisionResult = {
  decision: boolean;
  reasoning: string;
};

export type ExecutorDeps = {
  generateMessage: (directive: string) => Promise<{ suggestion: string; sourcesUsed: Array<Record<string, unknown>> } | null>;
  createDraft: (suggestion: string, sourcesUsed: Array<Record<string, unknown>>) => Promise<void>;
  sendMessage: (body: string) => Promise<void>;
  createTask: (title: string, priority: string, description?: string) => Promise<void>;
  sendNotification: (channels: string[], message: string) => Promise<void>;
  checkAiStatus: (reservationId: string) => Promise<'active' | 'paused'>;
  checkRateLimit: (reservationId: string) => Promise<boolean>;
  getCalendarData: (reservationId: string) => Promise<CalendarData>;
  makeAiDecision: (directive: string, calendarData: CalendarData) => Promise<AiDecisionResult>;
  setAiStatus: (reservationId: string, status: 'active' | 'paused', reason?: string) => Promise<void>;
};

export type StepResult = {
  action: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  nextExecutionAt?: Date;
  deferred?: boolean;
  skipToStep?: number;
};

export async function executeStep(
  step: JourneyStep,
  opts: {
    enrollment: EnrollmentContext;
    approvalMode: ApprovalMode;
    deps: ExecutorDeps;
  },
): Promise<StepResult> {
  const { enrollment, approvalMode, deps } = opts;

  switch (step.type) {
    case 'send_message':
    case 'upsell_offer': {
      const aiStatus = await deps.checkAiStatus(enrollment.reservationId);
      if (aiStatus === 'paused') {
        return { action: 'skipped', deferred: true, nextExecutionAt: new Date(Date.now() + 15 * 60 * 1000) };
      }

      const rateLimited = await deps.checkRateLimit(enrollment.reservationId);
      if (rateLimited) {
        return { action: 'skipped', deferred: true, nextExecutionAt: new Date(Date.now() + 15 * 60 * 1000) };
      }

      const directive = typeof step.directive === 'string' ? step.directive : JSON.stringify(step.directive);
      const result = await deps.generateMessage(directive);
      if (!result) {
        return { action: 'failed', output: { error: 'AI generation returned null' } };
      }

      if (approvalMode === 'draft') {
        await deps.createDraft(result.suggestion, result.sourcesUsed);
        return { action: 'message_drafted', output: { suggestion: result.suggestion } };
      }

      await deps.sendMessage(result.suggestion);
      return { action: 'message_sent', output: { suggestion: result.suggestion } };
    }

    case 'wait': {
      const directive = step.directive as Record<string, unknown>;
      let nextAt: Date;

      if ('delayMinutes' in directive) {
        nextAt = new Date(Date.now() + (directive.delayMinutes as number) * 60 * 1000);
      } else {
        // For 'until' waits, the cron handler pre-calculates the target time
        // This is a fallback for simple delay waits
        nextAt = new Date(Date.now() + 60 * 60 * 1000);
      }

      return { action: 'skipped', nextExecutionAt: nextAt };
    }

    case 'ai_decision': {
      const directive = typeof step.directive === 'string' ? step.directive : JSON.stringify(step.directive);
      const calendarData = await deps.getCalendarData(enrollment.reservationId);
      const decision = await deps.makeAiDecision(directive, calendarData);

      if (decision.decision) {
        return {
          action: 'ai_decision',
          output: { decision: true, reasoning: decision.reasoning },
        };
      }

      return {
        action: 'ai_decision',
        output: { decision: false, reasoning: decision.reasoning },
        skipToStep: step.skipToStep,
      };
    }

    case 'create_task': {
      const directive = step.directive as Record<string, unknown>;
      const title = (directive.title as string) ?? 'Journey-generated task';
      const priority = (directive.priority as string) ?? 'medium';
      const description = directive.description as string | undefined;
      await deps.createTask(title, priority, description);
      return { action: 'task_created', output: { title, priority } };
    }

    case 'send_notification': {
      const directive = step.directive as Record<string, unknown>;
      const channels = (directive.channels as string[]) ?? ['web'];
      const message = (directive.message as string) ?? '';
      await deps.sendNotification(channels, message);
      return { action: 'notification_sent', output: { channels, message } };
    }

    case 'pause_ai': {
      const directive = step.directive as Record<string, unknown>;
      const reason = (directive.reason as string) ?? 'journey-triggered';
      await deps.setAiStatus(enrollment.reservationId, 'paused', reason);
      return { action: 'ai_paused', output: { aiStatus: 'paused', reason } };
    }

    case 'resume_ai': {
      await deps.setAiStatus(enrollment.reservationId, 'active');
      return { action: 'ai_resumed', output: { aiStatus: 'active' } };
    }

    default:
      return { action: 'skipped', output: { error: `Unknown step type: ${step.type}` } };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx tsx --test src/lib/journeys/executor.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/journeys/executor.ts apps/web/src/lib/journeys/executor.test.ts
git commit -m "feat: add journey step executor with draft/autonomous modes"
```

---

## Task 10: AI Journey Generator

**Files:**
- Create: `apps/web/src/lib/journeys/generate-journey.ts`
- Create: `apps/web/src/lib/journeys/generate-journey.test.ts`

Takes a natural language prompt and returns a validated journey definition.

- [ ] **Step 1: Write tests**

Create `apps/web/src/lib/journeys/generate-journey.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';

import { generateJourneyFromPrompt } from './generate-journey';

void test('generateJourneyFromPrompt returns validated journey definition', async () => {
  const result = await generateJourneyFromPrompt(
    {
      prompt: 'Send a welcome message on booking, check-in instructions 2 days before, and a review request after checkout',
      propertyIds: ['prop-1'],
      organizationId: 'org-1',
    },
    {
      resolvePropertyContext: async () => 'Beach House, 3BR, pool, check-in 4pm',
      callAI: async () => JSON.stringify({
        name: 'Guest Welcome Journey',
        description: 'Full lifecycle from booking to review request',
        triggerType: 'booking_confirmed',
        triggerConfig: {},
        steps: [
          { type: 'send_message', directive: 'Thank the guest for booking' },
          { type: 'wait', directive: { until: 'check_in', offsetHours: -48 } },
          { type: 'send_message', directive: 'Send check-in instructions with door code and parking' },
          { type: 'wait', directive: { until: 'check_out', offsetHours: 4 } },
          { type: 'send_message', directive: 'Thank the guest and ask for a review' },
        ],
        coverageSchedule: null,
        approvalMode: 'draft',
      }),
    },
  );

  assert.ok(result.success);
  if (result.success) {
    assert.equal(result.journey.name, 'Guest Welcome Journey');
    assert.equal(result.journey.steps.length, 5);
    assert.equal(result.journey.triggerType, 'booking_confirmed');
  }
});

void test('generateJourneyFromPrompt returns error for invalid AI output', async () => {
  const result = await generateJourneyFromPrompt(
    { prompt: 'Do something', propertyIds: [], organizationId: 'org-1' },
    {
      resolvePropertyContext: async () => '',
      callAI: async () => '{ invalid json }}}',
    },
  );

  assert.equal(result.success, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx tsx --test src/lib/journeys/generate-journey.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the journey generator**

Create `apps/web/src/lib/journeys/generate-journey.ts`:

```typescript
import { journeyDefinitionSchema, type JourneyDefinition, type TriggerType } from '@walt/contracts';

type GenerateInput = {
  prompt: string;
  propertyIds: string[];
  organizationId: string;
};

type GenerateDeps = {
  resolvePropertyContext: (orgId: string, propertyIds: string[]) => Promise<string>;
  callAI: (systemPrompt: string, userPrompt: string) => Promise<string>;
};

type GenerateResult =
  | { success: true; journey: JourneyDefinition; considerations: string[] }
  | { success: false; error: string };

const TRIGGER_TYPES: TriggerType[] = [
  'booking_confirmed', 'check_in_approaching', 'check_in',
  'check_out_approaching', 'check_out', 'message_received',
  'gap_detected', 'sentiment_changed', 'booking_cancelled', 'manual',
];

const STEP_TYPES = [
  'send_message', 'wait', 'ai_decision', 'create_task',
  'send_notification', 'upsell_offer', 'pause_ai', 'resume_ai',
];

const SYSTEM_PROMPT = `You are an AI that generates journey automation definitions for a short-term rental platform.

You must return valid JSON matching this schema:
{
  "name": string,
  "description": string,
  "triggerType": one of [${TRIGGER_TYPES.join(', ')}],
  "triggerConfig": object (e.g. {"offsetHours": -48} for time-based triggers),
  "steps": array of step objects,
  "coverageSchedule": null or {"timezone": string, "windows": [{"days": ["mon",...], "startHour": 0-24, "endHour": 0-24}]},
  "approvalMode": "draft"
}

Each step has:
- "type": one of [${STEP_TYPES.join(', ')}]
- "directive": string (natural language instruction) or object (for wait/create_task/send_notification)
- "skipToStep": optional number (for ai_decision — index to jump to if condition is false)

For wait steps, use:
- {"delayMinutes": N} for fixed delays
- {"until": "check_in"|"check_out"|..., "offsetHours": N} for relative waits (preferred)

IMPORTANT RULES:
- Prefer "until" waits over fixed delays when possible
- Use send_message for guest-facing messages (the AI fills in actual property details at runtime)
- Use ai_decision when the journey needs to check a condition (calendar availability, guest sentiment, etc.)
- Keep directives clear and specific — they tell the AI what to communicate, not the exact words
- Default approvalMode to "draft" (host reviews before sending)
- Return ONLY the JSON object, no markdown code blocks or explanation

Also return a "considerations" array of strings with edge cases or suggestions.
Return the full response as: {"journey": {...}, "considerations": [...]}`;

export async function generateJourneyFromPrompt(
  input: GenerateInput,
  deps: GenerateDeps,
): Promise<GenerateResult> {
  const propertyContext = await deps.resolvePropertyContext(input.organizationId, input.propertyIds);

  const userPrompt = [
    `Generate a journey for this request: "${input.prompt}"`,
    propertyContext ? `\nProperty context:\n${propertyContext}` : '',
  ].join('');

  let raw: string;
  try {
    raw = await deps.callAI(SYSTEM_PROMPT, userPrompt);
  } catch {
    return { success: false, error: 'AI call failed' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { success: false, error: 'AI returned invalid JSON' };
  }

  const wrapper = parsed as { journey?: unknown; considerations?: string[] };
  const journeyData = wrapper.journey ?? parsed;
  const considerations = wrapper.considerations ?? [];

  const validation = journeyDefinitionSchema.safeParse(journeyData);
  if (!validation.success) {
    return { success: false, error: `Validation failed: ${validation.error.message}` };
  }

  return { success: true, journey: validation.data, considerations };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx tsx --test src/lib/journeys/generate-journey.test.ts`
Expected: All 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/journeys/generate-journey.ts apps/web/src/lib/journeys/generate-journey.test.ts
git commit -m "feat: add AI journey generator from natural language prompts"
```

---

## Task 11: Journey CRUD API Routes

**Files:**
- Create: `apps/web/src/app/api/journeys/handler.ts`
- Create: `apps/web/src/app/api/journeys/route.ts`
- Create: `apps/web/src/app/api/journeys/generate/handler.ts`
- Create: `apps/web/src/app/api/journeys/generate/route.ts`
- Create: `apps/web/src/app/api/journeys/[id]/handler.ts`
- Create: `apps/web/src/app/api/journeys/[id]/route.ts`
- Create: `apps/web/src/app/api/journeys/[id]/activate/handler.ts`
- Create: `apps/web/src/app/api/journeys/[id]/activate/route.ts`
- Create: `apps/web/src/app/api/journeys/[id]/pause/handler.ts`
- Create: `apps/web/src/app/api/journeys/[id]/pause/route.ts`

This task creates the CRUD + AI generation endpoints. Follow the existing route handler pattern exactly.

- [ ] **Step 1: Write list + create handler tests**

Create `apps/web/src/app/api/journeys/handler.test.ts` with tests for:
- GET returns org-scoped journeys
- GET filters by status
- POST with valid generate input creates journey
- POST with missing prompt returns 400

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Write list handler**

`apps/web/src/app/api/journeys/handler.ts` — `handleListJourneys` wrapped with `withPermission('journeys.read', ...)`:
- Query `journeys` table filtered by `organizationId` from auth context
- Support `?status=active` filter
- Cursor-based pagination with `limit` (default 50)
- Return JSON array

- [ ] **Step 4: Write route.ts**

`apps/web/src/app/api/journeys/route.ts`:
```typescript
import { handleListJourneys } from './handler';
export const GET = handleListJourneys;
```

- [ ] **Step 5: Write generate handler**

`apps/web/src/app/api/journeys/generate/handler.ts` — `handleGenerateJourney` wrapped with `withPermission('journeys.write', ...)`:
- Validate input with `generateJourneyInputSchema.safeParse(body)`
- Call `generateJourneyFromPrompt()` with real deps (OpenAI, knowledge resolver)
- Insert journey into DB with status `draft`
- Return the created journey + considerations

- [ ] **Step 6: Write generate route.ts**

```typescript
import { handleGenerateJourney } from './handler';
export const POST = handleGenerateJourney;
```

- [ ] **Step 7: Write get/update/delete handler**

`apps/web/src/app/api/journeys/[id]/handler.ts`:
- `handleGetJourney` — GET single journey by ID, org-scoped
- `handleUpdateJourney` — PUT updates name, description, steps, coverageSchedule, approvalMode. Increments `version`
- `handleDeleteJourney` — DELETE sets status to `archived`

- [ ] **Step 8: Write [id] route.ts**

```typescript
import { handleGetJourney, handleUpdateJourney, handleDeleteJourney } from './handler';
export const GET = handleGetJourney;
export const PUT = handleUpdateJourney;
export const DELETE = handleDeleteJourney;
```

- [ ] **Step 9: Write activate + pause handlers and routes**

`activate/handler.ts` — sets journey status to `active`
`pause/handler.ts` — sets journey status to `paused`

Both use POST method, wrapped with `withPermission('journeys.write', ...)`.

- [ ] **Step 10: Write generate/edit handler**

`apps/web/src/app/api/journeys/generate/edit/handler.ts` — `handleEditJourney` wrapped with `withPermission('journeys.write', ...)`:
- Validate input with `editJourneyInputSchema.safeParse(body)`
- Load existing journey definition
- Call AI with: system prompt (same as generate) + "Current journey: [JSON]" + "Modification instruction: [user input]"
- Validate AI output with `journeyDefinitionSchema`
- Return modified journey (does not persist — host reviews first)

`apps/web/src/app/api/journeys/generate/edit/route.ts`:
```typescript
import { handleEditJourney } from './handler';
export const POST = handleEditJourney;
```

- [ ] **Step 11: Write exclude handler**

`apps/web/src/app/api/journeys/[id]/exclude/handler.ts` — `handleExcludeReservation` wrapped with `withPermission('journeys.write', ...)`:
- Validate body has `reservationId` string
- Insert into `journeyExclusions` table
- If enrollment exists for this journey + reservation, cancel it
- Return 201

`apps/web/src/app/api/journeys/[id]/exclude/route.ts`:
```typescript
import { handleExcludeReservation } from './handler';
export const POST = handleExcludeReservation;
```

- [ ] **Step 12: Run tests to verify they pass**

Run: `cd apps/web && npx tsx --test src/app/api/journeys/handler.test.ts`
Expected: PASS

- [ ] **Step 13: Run typecheck**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 14: Commit**

```bash
git add apps/web/src/app/api/journeys/
git commit -m "feat: add journey CRUD, AI generation, edit, and exclude API routes"
```

---

## Task 12: Journey Execution Cron Handler

**Files:**
- Create: `apps/web/src/app/api/cron/execute-journeys/handler.ts`
- Create: `apps/web/src/app/api/cron/execute-journeys/handler.test.ts`
- Create: `apps/web/src/app/api/cron/execute-journeys/route.ts`

The main executor cron — runs every 1-2 minutes, processes due enrollments.

- [ ] **Step 1: Write tests**

Create `apps/web/src/app/api/cron/execute-journeys/handler.test.ts` with tests for:
- Returns 401 without valid CRON_SECRET
- Processes due enrollments and advances step index
- Defers steps outside coverage window
- Pauses enrollment after 3 retries and sends notification
- Cancels enrollments for cancelled reservations
- Respects rate limiting (skips if message sent within 15 min)
- Handles version-pinned steps from enrollment context

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Write the cron handler**

`apps/web/src/app/api/cron/execute-journeys/handler.ts`:
- Verify `Bearer ${CRON_SECRET}` auth
- Query `journeyEnrollments` where `nextExecutionAt <= now AND status = 'active'` with limit 50
- For each enrollment:
  1. Load journey definition
  2. Get step from `context.stepsSnapshot[currentStepIndex]`
  3. Check coverage schedule via `isWithinCoverageWindow()`
  4. If outside window → defer to `getNextWindowStart()`
  5. Call `executeStep()` with wired-up deps
  6. Insert `journeyExecutionLog` record
  7. Handle result: advance step, set `nextExecutionAt`, or handle `skipToStep`
  8. On failure: increment `retryCount`, exponential backoff. If `retryCount >= 3`, pause enrollment + send notification
  9. If last step completed → set enrollment status `completed`
- Return `{ ok: true, processed: N, failed: N }`

- [ ] **Step 4: Write route.ts**

```typescript
import { handleExecuteJourneys } from './handler';
export const POST = handleExecuteJourneys;
```

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/cron/execute-journeys/
git commit -m "feat: add journey execution cron handler"
```

---

## Task 13: Enrollment Trigger Cron Handlers

**Files:**
- Create: `apps/web/src/app/api/cron/enroll-time-triggers/handler.ts`
- Create: `apps/web/src/app/api/cron/enroll-time-triggers/handler.test.ts`
- Create: `apps/web/src/app/api/cron/enroll-time-triggers/route.ts`
- Create: `apps/web/src/app/api/cron/detect-gaps/handler.ts`
- Create: `apps/web/src/app/api/cron/detect-gaps/handler.test.ts`
- Create: `apps/web/src/app/api/cron/detect-gaps/route.ts`
- Create: `apps/web/src/lib/journeys/enrollment.ts`
- Create: `apps/web/src/lib/journeys/enrollment.test.ts`

- [ ] **Step 1: Write enrollment logic tests**

`apps/web/src/lib/journeys/enrollment.test.ts`:
- `enrollReservation` creates enrollment with version snapshot in context
- `enrollReservation` skips if enrollment already exists (unique constraint)
- `enrollReservation` skips if reservation is in exclusion list
- `findMatchingJourneys` returns journeys matching trigger type + property

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Write enrollment logic**

`apps/web/src/lib/journeys/enrollment.ts`:
- `enrollReservation(journeyId, reservationId, deps)` — creates enrollment with `stepsSnapshot` in context, calculates `nextExecutionAt` for first step
- `findMatchingJourneys(triggerType, propertyId, orgId, deps)` — queries active journeys matching trigger + property

- [ ] **Step 4: Write time trigger cron handler**

`apps/web/src/app/api/cron/enroll-time-triggers/handler.ts`:
- For each active time-based journey (`check_in_approaching`, `check_out_approaching`, `check_in`, `check_out`):
  - Query reservations matching the trigger condition (e.g., check-in within `offsetHours` of now)
  - Filter out already-enrolled and excluded reservations
  - Call `enrollReservation` for each match

- [ ] **Step 5: Write gap detection cron handler**

`apps/web/src/app/api/cron/detect-gaps/handler.ts`:
- Query active journeys with `triggerType = 'gap_detected'`
- For each property, scan reservations sorted by check-in
- Find gaps between consecutive reservations within `maxGapNights`
- Enroll adjacent reservations into gap-night journeys

- [ ] **Step 6: Write route files**

- [ ] **Step 7: Run tests to verify they pass**

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/journeys/enrollment.ts apps/web/src/lib/journeys/enrollment.test.ts apps/web/src/app/api/cron/enroll-time-triggers/ apps/web/src/app/api/cron/detect-gaps/
git commit -m "feat: add enrollment trigger cron handlers for time-based and gap detection"
```

---

## Task 14: Per-Conversation AI Controls API

**Files:**
- Create: `apps/web/src/app/api/conversations/[reservationId]/ai-status/handler.ts`
- Create: `apps/web/src/app/api/conversations/[reservationId]/ai-status/route.ts`

- [ ] **Step 1: Write tests**

Test PUT endpoint:
- Pauses conversation with duration → sets `aiPausedUntil`
- Pauses indefinitely → `aiPausedUntil = null`
- Resumes conversation → sets status `active`
- Returns 400 for invalid input

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Write handler**

`handler.ts` — `handleUpdateAiStatus` wrapped with `withPermission('conversations.write', ...)`:
- Validate with `updateAiStatusInputSchema.safeParse(body)`
- Upsert into `conversationSettings` table (insert or update on conflict)
- If `pauseDurationMinutes` provided, calculate `aiPausedUntil = now + duration`
- Return updated status

- [ ] **Step 4: Write route.ts**

```typescript
import { handleUpdateAiStatus } from './handler';
export const PUT = handleUpdateAiStatus;
```

- [ ] **Step 5: Run tests, commit**

```bash
git add apps/web/src/app/api/conversations/
git commit -m "feat: add per-conversation AI status controls"
```

---

## Task 15: Upsell Tracking API

**Files:**
- Create: `apps/web/src/app/api/upsells/handler.ts`
- Create: `apps/web/src/app/api/upsells/route.ts`
- Create: `apps/web/src/app/api/upsells/[id]/handler.ts`
- Create: `apps/web/src/app/api/upsells/[id]/route.ts`
- Create: `apps/web/src/app/api/upsells/stats/handler.ts`
- Create: `apps/web/src/app/api/upsells/stats/route.ts`

- [ ] **Step 1: Write tests**

- GET /api/upsells returns org-scoped upsell events
- PUT /api/upsells/:id updates status and actual revenue
- GET /api/upsells/stats returns revenue summary

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Write handlers following CRUD pattern**

- List handler: cursor-based pagination, filter by property/status/type
- Update handler: validate with `updateUpsellInputSchema`, update status + actualRevenue + respondedAt
- Stats handler: aggregate estimatedRevenue, actualRevenue, counts by status and upsellType

- [ ] **Step 4: Write route files**

- [ ] **Step 5: Run tests, commit**

```bash
git add apps/web/src/app/api/upsells/
git commit -m "feat: add upsell tracking API with revenue stats"
```

---

## Task 16: Notifications API

**Files:**
- Create: `apps/web/src/app/api/notifications/handler.ts`
- Create: `apps/web/src/app/api/notifications/route.ts`
- Create: `apps/web/src/app/api/notifications/[id]/read/handler.ts`
- Create: `apps/web/src/app/api/notifications/[id]/read/route.ts`
- Create: `apps/web/src/app/api/notifications/read-all/handler.ts`
- Create: `apps/web/src/app/api/notifications/read-all/route.ts`
- Create: `apps/web/src/app/api/notifications/preferences/handler.ts`
- Create: `apps/web/src/app/api/notifications/preferences/route.ts`

- [ ] **Step 1: Write tests**

- GET /api/notifications returns paginated, filterable notifications
- GET /api/notifications includes unread count in response headers or body
- PUT /api/notifications/:id/read marks as read
- PUT /api/notifications/read-all marks all org notifications as read
- GET /api/notifications/preferences returns org preferences
- PUT /api/notifications/preferences upserts preference

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Write handlers**

- List: cursor-based pagination, filter by category, `readAt IS NULL` for unread
- Mark read: set `readAt = now`
- Mark all read: bulk update where `readAt IS NULL AND organizationId = orgId`
- Preferences GET: query by orgId, optionally by memberId
- Preferences PUT: upsert by (orgId, memberId, category)

- [ ] **Step 4: Write route files**

- [ ] **Step 5: Run tests, commit**

```bash
git add apps/web/src/app/api/notifications/
git commit -m "feat: add notifications API with preferences and read tracking"
```

---

## Task 17: Integration — Wire scan-messages to Check AI Status

**Files:**
- Modify: `apps/web/src/app/api/cron/scan-messages/handler.ts`

The existing scan-messages cron needs to respect the new `conversationSettings.aiStatus` flag.

- [ ] **Step 1: Write test for AI status check in scan-messages**

Add to existing test file or create new test:
- scan-messages skips suggestion generation when conversation AI status is `paused`
- scan-messages still logs intent/escalation analysis when paused

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Modify scan-messages handler**

In the message processing loop, after getting reservation context:
1. Query `conversationSettings` for the reservation
2. If `aiStatus === 'paused'` (and `aiPausedUntil` is null or in the future):
   - Still run `analyzeMessage()` for intent/escalation detection
   - Skip `generateReplySuggestion()` and draft creation
   - Mark message as scanned

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/cron/scan-messages/
git commit -m "feat: scan-messages respects per-conversation AI status"
```

---

## Task 18: Full Typecheck + Lint

**Files:** None (verification only)

- [ ] **Step 1: Run full monorepo typecheck**

Run: `pnpm turbo run typecheck lint`
Expected: PASS for all packages

- [ ] **Step 2: Run full build for web**

Run: `pnpm turbo run typecheck lint build --filter=@walt/web`
Expected: PASS

- [ ] **Step 3: Fix any remaining errors**

If any typecheck or lint errors, fix them.

- [ ] **Step 4: Run all tests**

Run: `cd apps/web && npx tsx --test src/lib/journeys/*.test.ts src/app/api/cron/execute-journeys/handler.test.ts src/app/api/cron/enroll-time-triggers/handler.test.ts src/app/api/cron/detect-gaps/handler.test.ts`

Run: `cd packages/contracts && npx tsx --test src/journeys.test.ts`
Run: `cd packages/sms && npx tsx --test src/client.test.ts`
Run: `cd packages/email && npx tsx --test src/client.test.ts`
Run: `cd packages/slack && npx tsx --test src/client.test.ts`
Run: `cd packages/notifications && npx tsx --test src/router.test.ts`

Expected: All tests PASS

- [ ] **Step 5: Commit any fixes**

Stage only the specific files that were fixed (do not use `git add -A`):

```bash
git add <specific-files-with-fixes>
git commit -m "fix: resolve typecheck and lint issues across journey engine"
```

---

## Task Summary

| # | Task | Dependencies | Est. Files |
|---|------|-------------|-----------|
| 1 | Journey Zod Schemas | None | 3 |
| 1b | Notification Schemas + Permissions | None | 3 |
| 2 | Database Schema | Task 1 | 2+ |
| 3 | @walt/sms Package | None | 5 |
| 4 | @walt/email Package | None | 5 |
| 5 | @walt/slack Package | None | 5 |
| 6 | @walt/notifications Package | Tasks 3, 4, 5 | 6 |
| 7 | Coverage Schedule Evaluator | None | 2 |
| 8 | Journey Message Generator | Task 1 | 2 |
| 9 | Journey Executor Core | Tasks 1, 7, 8 | 2 |
| 10 | AI Journey Generator | Task 1 | 2 |
| 11 | Journey CRUD API | Tasks 1b, 2, 10 | 16 |
| 12 | Execution Cron Handler | Tasks 2, 7, 9 | 3 |
| 13 | Enrollment Cron Handlers | Tasks 2, 12 | 8 |
| 14 | Conversation AI Controls | Tasks 1b, 2 | 2 |
| 15 | Upsell Tracking API | Tasks 1b, 2 | 6 |
| 16 | Notifications API | Tasks 1b, 2, 6 | 8 |
| 17 | Wire scan-messages | Task 14 | 1 |
| 18 | Full Typecheck + Lint | All | 0 |

**Parallelizable groups:**
- Tasks 1, 1b, 3, 4, 5, 7 can all run in parallel (no shared dependencies)
- Tasks 8, 9, 10 depend on Task 1 but are independent of each other
- Tasks 11-16 depend on Tasks 1b + 2 but are largely independent of each other
