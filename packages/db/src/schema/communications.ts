import { pgTable, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { profiles } from './profiles'

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  profileId: text('profileId').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'enrollment_confirmed', 'waitlisted', 'tournament_reminder', 'results_posted', 'system'
  title: text('title').notNull(),
  body: text('body').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
})

export const emailLogs = pgTable('email_logs', {
  id: text('id').primaryKey(),
  profileId: text('profileId').references(() => profiles.id, { onDelete: 'set null' }),
  to: text('to').notNull(),
  template: text('template').notNull(), // 'welcome', 'enrollment_confirmed', 'waitlisted', 'tournament_reminder', 'results', 'cancellation'
  status: text('status').notNull().default('pending'), // 'pending', 'sent', 'failed'
  error: text('error'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sentAt', { withTimezone: true }),
})
