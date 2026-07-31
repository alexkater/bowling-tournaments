import { eq, desc, sql } from 'drizzle-orm'
import { z } from 'zod'
import { router, procedure } from '../trpc'
import { notifications } from '@bowling/db'
import { TRPCError } from '@trpc/server'
import { requireAuth } from '../middleware/auth'

export const notificationRouter = router({
  list: procedure
    .use(requireAuth)
    .input(z.object({
      limit: z.number().default(50),
      unreadOnly: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(notifications.profileId, ctx.userId!)]
      if (input.unreadOnly) conditions.push(eq(notifications.read, false))

      const items = await ctx.db
        .select()
        .from(notifications)
        .where(sql`${conditions.join(' AND ')}`)
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
