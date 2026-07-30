import { pgTable, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { organizations } from './organizations'
import { stages } from './stages'
import { tournamentPlayers } from './tournament_players'
import { bracketPools } from './brackets'
import { sidepots } from './sidepots'
import { paymentTransactions } from './payments'

export const tournaments = pgTable('tournaments', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text().notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  description: text(),
  status: text().notNull().default('draft'), // 'draft' | 'published' | 'in_progress' | 'completed' | 'cancelled'
  category: text().notNull().default('open'), // 'open' | 'women' | 'senior' | 'youth' | 'mixed'
  centerId: text(),
  maxPlayers: integer(),
  allowWaitlist: boolean().notNull().default(true),
  startDate: timestamp({ withTimezone: true }).notNull(),
  endDate: timestamp({ withTimezone: true }).notNull(),
  registrationDeadline: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  organization: one(organizations, { fields: [tournaments.organizationId], references: [organizations.id] }),
  stages: many(stages),
  players: many(tournamentPlayers),
  bracketPools: many(bracketPools),
  sidepots: many(sidepots),
  paymentTransactions: many(paymentTransactions),
}))
