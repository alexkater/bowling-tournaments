import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { tournaments } from './tournaments';

export type ScoreAuditValue = {
  gameNumber?: number;
  rawScore?: number;
  handicapScore?: number | null;
  pins?: number[];
  player1Score?: number | null;
  player2Score?: number | null;
  winnerId?: string | null;
};

export const scoreAuditLogs = pgTable(
  'score_audit_logs',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    tournamentId: text()
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    actorProfileId: text().notNull(),
    resourceType: text().notNull(), // 'game' | 'bracket_match'
    resourceId: text().notNull(),
    operation: text().notNull(), // 'created' | 'updated'
    previousValue: jsonb().$type<ScoreAuditValue | null>(),
    newValue: jsonb().$type<ScoreAuditValue>().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('score_audit_logs_tournament_created_idx').on(table.tournamentId, table.createdAt),
    index('score_audit_logs_resource_idx').on(table.resourceType, table.resourceId),
    index('score_audit_logs_actor_idx').on(table.actorProfileId, table.createdAt),
  ],
);

export const scoreAuditLogsRelations = relations(scoreAuditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [scoreAuditLogs.organizationId],
    references: [organizations.id],
  }),
  tournament: one(tournaments, {
    fields: [scoreAuditLogs.tournamentId],
    references: [tournaments.id],
  }),
}));
