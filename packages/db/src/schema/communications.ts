import { pgTable, text, boolean, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core'
import { profiles } from './profiles'

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  profileId: text('profileId').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
})

export const emailLogs = pgTable(
  'email_logs',
  {
    id: text('id').primaryKey(),
    idempotencyKey: text('idempotencyKey').notNull().unique(),
    profileId: text('profileId').references(() => profiles.id, { onDelete: 'set null' }),
    to: text('to').notNull(),
    template: text('template').notNull(),
    payload: jsonb('payload').$type<Record<string, string>>().notNull().default({}),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('maxAttempts').notNull().default(5),
    nextAttemptAt: timestamp('nextAttemptAt', { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp('lockedAt', { withTimezone: true }),
    providerMessageId: text('providerMessageId'),
    error: text('error'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sentAt', { withTimezone: true }),
  },
  (table) => [index('email_logs_due_idx').on(table.status, table.nextAttemptAt, table.createdAt)],
)
