import { and, eq, desc, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { router, procedure } from '../trpc'
import { notifications, profiles, tournamentPlayers, tournaments } from '@bowling/db'
import { TRPCError } from '@trpc/server'
import { requireAuth, requireOrgAccess, requireOrgRole } from '../middleware/auth'
import { createNotification } from '../services/notifications'
import { queueEmail } from '../services/email'

export const notificationRouter = router({
  broadcast: procedure
    .use(requireOrgAccess)
    .use(requireOrgRole(['owner', 'admin']))
    .input(z.object({
      tournamentId: z.string().uuid(),
      clientMutationId: z.string().uuid(),
      subject: z.string().trim().min(3).max(120),
      body: z.string().trim().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const [tournament] = await tx
          .select({ id: tournaments.id, name: tournaments.name })
          .from(tournaments)
          .where(and(
            eq(tournaments.id, input.tournamentId),
            eq(tournaments.organizationId, ctx.orgId),
          ))
          .limit(1)

        if (!tournament) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tournament not found' })
        }

        const recipients = await tx
          .select({
            profileId: profiles.id,
            email: profiles.email,
            firstName: profiles.firstName,
          })
          .from(tournamentPlayers)
          .innerJoin(profiles, eq(tournamentPlayers.profileId, profiles.id))
          .where(and(
            eq(tournamentPlayers.tournamentId, tournament.id),
            inArray(tournamentPlayers.status, ['confirmed', 'waitlisted']),
          ))

        for (const recipient of recipients) {
          await createNotification({
            db: tx,
            id: `announcement:${input.clientMutationId}:${recipient.profileId}`,
            profileId: recipient.profileId,
            type: 'announcement',
            title: input.subject,
            body: input.body,
            metadata: {
              tournamentId: tournament.id,
              clientMutationId: input.clientMutationId,
              createdBy: ctx.userId,
            },
          })
          await queueEmail({
            db: tx,
            idempotencyKey: `announcement:${input.clientMutationId}:${recipient.profileId}`,
            profileId: recipient.profileId,
            to: recipient.email,
            template: 'announcement',
            data: {
              firstName: recipient.firstName,
              tournamentName: tournament.name,
              subject: input.subject,
              body: input.body,
            },
          })
        }

        return { recipients: recipients.length }
      })
    }),

  list: procedure
    .use(requireAuth)
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(50),
      unreadOnly: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(notifications.profileId, ctx.userId!)]
      if (input.unreadOnly) conditions.push(eq(notifications.read, false))

      const items = await ctx.db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(input.limit)

      return items
    }),

  unreadCount: procedure
    .use(requireAuth)
    .query(async ({ ctx }) => {
      const [result] = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(sql`${notifications.profileId} = ${ctx.userId!} AND ${notifications.read} = false`)

      return result?.count ?? 0
    }),

  markRead: procedure
    .use(requireAuth)
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(notifications)
        .set({ read: true })
        .where(sql`${notifications.id} = ${input.id} AND ${notifications.profileId} = ${ctx.userId!}`)
        .returning()

      if (!result.length) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Notification not found' })
      }
      return result[0]
    }),

  markAllRead: procedure
    .use(requireAuth)
    .mutation(async ({ ctx }) => {
      await ctx.db
        .update(notifications)
        .set({ read: true })
        .where(sql`${notifications.profileId} = ${ctx.userId!} AND ${notifications.read} = false`)
      return { ok: true }
    }),
})
