import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { profiles } from './profiles'

export const authTokens = pgTable(
  'auth_tokens',
  {
    id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
    profileId: text().notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    tokenHash: text().notNull().unique(),
    type: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index('auth_tokens_profile_type_idx').on(table.profileId, table.type),
    index('auth_tokens_expiry_idx').on(table.expiresAt),
  ],
)

export const authRateLimits = pgTable(
  'auth_rate_limits',
  {
    key: text().primaryKey(),
    action: text().notNull(),
    count: integer().notNull(),
    windowStartedAt: timestamp({ withTimezone: true }).notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [index('auth_rate_limits_expiry_idx').on(table.expiresAt)],
)
