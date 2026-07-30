import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { organizationMembers } from './organizations'
import { tournamentPlayers } from './tournament_players'
import { games } from './games'

export const profiles = pgTable('profiles', {
  id: text().primaryKey(), // references auth.users (Supabase)
  firstName: text().notNull(),
  lastName: text().notNull(),
  email: text().notNull(),
  role: text().notNull().default('player'), // 'player' | 'organizer'
  phone: text(),
  usbcId: text(),
  average: integer(),
  handicap: integer(),
  birthYear: integer(),
  avatarUrl: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})

export const profilesRelations = relations(profiles, ({ many }) => ({
  memberships: many(organizationMembers),
  tournamentEntries: many(tournamentPlayers),
  games: many(games),
}))
