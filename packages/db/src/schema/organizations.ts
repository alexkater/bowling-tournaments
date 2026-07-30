import { pgTable, text, timestamp, boolean, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { profiles } from './profiles'
import { tournaments } from './tournaments'

export const organizations = pgTable('organizations', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text().notNull(),
  slug: text().notNull().unique(),
  stripeAccountId: text(),
  isActive: boolean().notNull().default(true),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  tournaments: many(tournaments),
}))

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text().notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    profileId: text().notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    role: text().notNull().default('member'), // 'owner' | 'admin' | 'member'
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('organization_members_organization_profile_unique').on(
      table.organizationId,
      table.profileId,
    ),
  ],
)

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, { fields: [organizationMembers.organizationId], references: [organizations.id] }),
  profile: one(profiles, { fields: [organizationMembers.profileId], references: [profiles.id] }),
}))
