import { pgTable, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tournaments } from './tournaments'
import { squads } from './squads'

export const stages = pgTable('stages', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  tournamentId: text().notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  sortOrder: integer().notNull(),
  format: jsonb().notNull(),         // StageFormatConfig
  advancement: jsonb().notNull(),     // AdvancementConfig
  squadConfig: jsonb(),              // SquadConfig | null
  standingsScope: text().notNull().default('per_squad'), // 'per_squad' | 'combined'
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})

export const stagesRelations = relations(stages, ({ one, many }) => ({
  tournament: one(tournaments, { fields: [stages.tournamentId], references: [tournaments.id] }),
  squads: many(squads),
}))

export type StageFormatJson = import('@bowling/shared').StageFormatConfig
export type AdvancementJson = import('@bowling/shared').AdvancementConfig
