import { TRPCError } from '@trpc/server'
import { and, desc, eq } from 'drizzle-orm'
import { stages, tournaments } from '@bowling/db'
import { z } from 'zod'
import { requireOrgAccess } from '../middleware/auth'
import { procedure } from '../trpc'

const tournamentListInput = z.object({
  status: z.string().optional(),
  limit: z.number().default(20),
  cursor: z.string().optional(),
})

export const organizerListProcedure = procedure
  .use(requireOrgAccess)
  .input(tournamentListInput)
  .query(async ({ ctx, input }) => {
    const items = await ctx.db
      .select()
      .from(tournaments)
      .where(
        and(
          eq(tournaments.organizationId, ctx.orgId),
          input.status ? eq(tournaments.status, input.status) : undefined,
        ),
      )
      .orderBy(desc(tournaments.createdAt))
      .limit(input.limit)

    return {
      items,
      nextCursor: items.length === input.limit ? items[items.length - 1]?.id ?? null : null,
    }
  })

export const organizerByIdProcedure = procedure
  .use(requireOrgAccess)
  .input(z.string().uuid())
  .query(async ({ ctx, input }) => {
    const [tournament] = await ctx.db
      .select()
      .from(tournaments)
      .where(
        and(
          eq(tournaments.id, input),
          eq(tournaments.organizationId, ctx.orgId),
        ),
      )
      .limit(1)

    if (!tournament) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Tournament not found' })
    }

    const tournamentStages = await ctx.db
      .select()
      .from(stages)
      .where(eq(stages.tournamentId, input))
      .orderBy(stages.sortOrder)

    return { ...tournament, stages: tournamentStages }
  })
