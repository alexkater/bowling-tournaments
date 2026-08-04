import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tournaments } from './tournaments'
import { organizations } from './organizations'

export const tournamentDocuments = pgTable('tournament_documents', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  tournamentId: text().notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  organizationId: text().notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  title: text().notNull(),
  description: text(),
  fileName: text().notNull(),
  fileSize: integer().notNull(),
  mimeType: text().notNull().default('application/octet-stream'),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const tournamentDocumentsRelations = relations(tournamentDocuments, ({ one }) => ({
  tournament: one(tournaments, { fields: [tournamentDocuments.tournamentId], references: [tournaments.id] }),
  organization: one(organizations, { fields: [tournamentDocuments.organizationId], references: [organizations.id] }),
}))
