import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { stages } from './stages'
import { tournamentPlayers } from './tournament_players'

export const squads = pgTable('squads', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  stageId: text().notNull().references(() => stages.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  date: timestamp({ withTimezone: true }).notNull(),
  startTime: text().notNull(),
  status: text().notNull().default('pending'), // 'pending' | 'active' | 'completed'
  laneStart: integer(),
  laneEnd: integer(),
  maxPlayers: integer(),
  sortOrder: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})

export const squadsRelations = relations(squads, ({ one, many }) => ({
  stage: one(stages, { fields: [squads.stageId], references: [stages.id] }),
  players: many(tournamentPlayers),
}))
