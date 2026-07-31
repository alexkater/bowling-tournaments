import { pgTable, text, timestamp, integer, boolean, jsonb, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tournaments } from './tournaments'
import { squads } from './squads'
import { profiles } from './profiles'
import { games } from './games'
import { bracketEntries } from './brackets'
import { sidepotEntries } from './sidepots'
import { paymentTransactions } from './payments'

export const tournamentPlayers = pgTable(
  'tournament_players',
  {
    id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
    tournamentId: text().notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
    profileId: text().notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    squadId: text().notNull().references(() => squads.id, { onDelete: 'cascade' }),
    teamId: text(),
    lane: integer(),
    checkedIn: boolean().notNull().default(false),
    status: text().notNull().default('confirmed'), // 'confirmed' | 'waitlisted'
    eventEntries: jsonb().$type<Array<{
      eventType: 'singles' | 'doubles' | 'trios' | 'teams' | 'all_events'
      partners: string[]
    }>>().notNull().default([]),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('tournament_players_tournament_profile_unique').on(
      table.tournamentId,
      table.profileId,
    ),
  ],
)

// Unique constraint: a player can only register once per tournament
export const tournamentPlayersRelations = relations(tournamentPlayers, ({ one, many }) => ({
  tournament: one(tournaments, { fields: [tournamentPlayers.tournamentId], references: [tournaments.id] }),
  profile: one(profiles, { fields: [tournamentPlayers.profileId], references: [profiles.id] }),
  squad: one(squads, { fields: [tournamentPlayers.squadId], references: [squads.id] }),
  games: many(games),
  bracketEntries: many(bracketEntries),
  sidepotEntries: many(sidepotEntries),
  payments: many(paymentTransactions),
}))
