import { pgTable, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tournaments } from './tournaments'
import { tournamentPlayers } from './tournament_players'

export const sidepots = pgTable('sidepots', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  tournamentId: text().notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  type: text().notNull(), // 'high_game' | 'high_series' | 'eliminator' | 'mystery_doubles' | 'sweeper_doubles' | 'big_dog' | 'blind_draw'
  entryFee: integer().notNull().default(0), // cents
  config: jsonb().$type<{
    handicap: boolean
    maxEntries: number | null
    payoutRatio: number
    gamesIncluded: number[] // qué juegos aplican (ej: [1,2,3])
    gender: 'all' | 'male' | 'female' | null
  }>().notNull().default({
    handicap: false,
    maxEntries: null,
    payoutRatio: 0.8,
    gamesIncluded: [1, 2, 3],
    gender: 'all',
  }),
  status: text().notNull().default('open'), // 'open' | 'closed' | 'paid'
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})

export const sidepotsRelations = relations(sidepots, ({ one, many }) => ({
  tournament: one(tournaments, { fields: [sidepots.tournamentId], references: [tournaments.id] }),
  entries: many(sidepotEntries),
}))

export const sidepotEntries = pgTable('sidepot_entries', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  sidepotId: text().notNull().references(() => sidepots.id, { onDelete: 'cascade' }),
  tournamentPlayerId: text().notNull().references(() => tournamentPlayers.id, { onDelete: 'cascade' }),
  paid: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const sidepotEntriesRelations = relations(sidepotEntries, ({ one }) => ({
  sidepot: one(sidepots, { fields: [sidepotEntries.sidepotId], references: [sidepots.id] }),
  player: one(tournamentPlayers, { fields: [sidepotEntries.tournamentPlayerId], references: [tournamentPlayers.id] }),
}))
