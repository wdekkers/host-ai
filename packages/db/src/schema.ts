import { jsonb, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
