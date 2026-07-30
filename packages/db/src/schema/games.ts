import { pgTable, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tournamentPlayers } from './tournament_players'

export const games = pgTable('games', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  tournamentPlayerId: text().notNull().references(() => tournamentPlayers.id, { onDelete: 'cascade' }),
  gameNumber: integer().notNull(),
  rawScore: integer().notNull(),
  handicapScore: integer(),
  pins: jsonb().$type<number[]>().notNull().default([]),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})

export const gamesRelations = relations(games, ({ one }) => ({
  tournamentPlayer: one(tournamentPlayers, { fields: [games.tournamentPlayerId], references: [tournamentPlayers.id] }),
}))
