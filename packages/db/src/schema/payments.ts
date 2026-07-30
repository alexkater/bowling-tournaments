import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tournaments } from './tournaments'
import { tournamentPlayers } from './tournament_players'

export const paymentTransactions = pgTable('payment_transactions', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  tournamentId: text().notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  tournamentPlayerId: text().notNull().references(() => tournamentPlayers.id, { onDelete: 'cascade' }),
  type: text().notNull(), // 'registration' | 'sidepot' | 'bracket' | 'payout'
  amount: integer().notNull(), // cents (positive = charge, negative = refund/payout)
  stripePaymentId: text(),
  stripeTransferId: text(),
  status: text().notNull().default('pending'), // 'pending' | 'completed' | 'refunded' | 'failed'
  description: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})

export const paymentTransactionsRelations = relations(paymentTransactions, ({ one }) => ({
  tournament: one(tournaments, { fields: [paymentTransactions.tournamentId], references: [tournaments.id] }),
  tournamentPlayer: one(tournamentPlayers, { fields: [paymentTransactions.tournamentPlayerId], references: [tournamentPlayers.id] }),
}))
