import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { profiles } from './profiles'

export const userCredentials = pgTable('user_credentials', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  profileId: text().notNull().references(() => profiles.id, { onDelete: 'cascade' }).unique(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})

export const userCredentialsRelations = relations(userCredentials, ({ one }) => ({
  profile: one(profiles, { fields: [userCredentials.profileId], references: [profiles.id] }),
}))
