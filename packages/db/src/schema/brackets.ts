import { pgTable, text, timestamp, integer, jsonb, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tournaments } from './tournaments'
import { tournamentPlayers } from './tournament_players'

export const bracketPools = pgTable('bracket_pools', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  tournamentId: text().notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  type: text().notNull().default('eight_person_forward'), // 'eight_person_forward' | 'eight_person_reverse' | 'eight_person_eliminator' | 'single_elimination' | 'double_elimination'
  entryFee: integer().notNull().default(0), // cents
  maxPlayers: integer().notNull().default(8),
  status: text().notNull().default('open'), // 'open' | 'shuffling' | 'in_progress' | 'completed'
  config: jsonb().$type<{
    handicap: boolean
    allowMultipleEntries: boolean
    maxEntriesPerPlayer: number
    payoutRatio: number
    bracketSize: number
  }>().notNull().default({
    handicap: false,
    allowMultipleEntries: true,
    maxEntriesPerPlayer: 5,
    payoutRatio: 0.8,
    bracketSize: 8,
  }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})

export const bracketPoolsRelations = relations(bracketPools, ({ one, many }) => ({
  tournament: one(tournaments, { fields: [bracketPools.tournamentId], references: [tournaments.id] }),
  rounds: many(bracketRounds),
  entries: many(bracketEntries),
}))

export const bracketRounds = pgTable('bracket_rounds', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  bracketPoolId: text().notNull().references(() => bracketPools.id, { onDelete: 'cascade' }),
  roundNumber: integer().notNull(),
  completed: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const bracketRoundsRelations = relations(bracketRounds, ({ one, many }) => ({
  pool: one(bracketPools, { fields: [bracketRounds.bracketPoolId], references: [bracketPools.id] }),
  matches: many(bracketMatches),
}))

export const bracketMatches = pgTable('bracket_matches', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  roundId: text().notNull().references(() => bracketRounds.id, { onDelete: 'cascade' }),
  position: integer().notNull(),
  player1Id: text().references(() => tournamentPlayers.id),
  player2Id: text().references(() => tournamentPlayers.id),
  player1Score: integer(),
  player2Score: integer(),
  winnerId: text().references(() => tournamentPlayers.id),
  nextMatchId: text(),
  nextMatchPosition: text(), // 'top' | 'bottom'
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const bracketMatchesRelations = relations(bracketMatches, ({ one }) => ({
  round: one(bracketRounds, { fields: [bracketMatches.roundId], references: [bracketRounds.id] }),
  player1: one(tournamentPlayers, { fields: [bracketMatches.player1Id], references: [tournamentPlayers.id] }),
  player2: one(tournamentPlayers, { fields: [bracketMatches.player2Id], references: [tournamentPlayers.id] }),
  winner: one(tournamentPlayers, { fields: [bracketMatches.winnerId], references: [tournamentPlayers.id] }),
}))

export const bracketEntries = pgTable('bracket_entries', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  bracketPoolId: text().notNull().references(() => bracketPools.id, { onDelete: 'cascade' }),
  tournamentPlayerId: text().notNull().references(() => tournamentPlayers.id, { onDelete: 'cascade' }),
  entryNumber: integer().notNull().default(1),
  paid: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const bracketEntriesRelations = relations(bracketEntries, ({ one }) => ({
  pool: one(bracketPools, { fields: [bracketEntries.bracketPoolId], references: [bracketPools.id] }),
  player: one(tournamentPlayers, { fields: [bracketEntries.tournamentPlayerId], references: [tournamentPlayers.id] }),
}))
