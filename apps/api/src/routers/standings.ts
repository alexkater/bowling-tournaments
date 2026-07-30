import { z } from 'zod'
import { eq, inArray, asc } from 'drizzle-orm'
import { router, procedure } from '../trpc'
import { requireAuth } from '../middleware'
import { squads, stages } from '@bowling/db'
import type { StandingsEntry } from '@bowling/shared'
import { TRPCError } from '@trpc/server'
import {
  getStageConfig,
  computeSquadStandings,
  rankAndCut,
} from '../services/standings.service'

export interface CombinedStandings {
  scope: 'combined'
  standings: StandingsEntry[]
}

export interface PerSquadStandingsGroup {
  squadId: string
  squadName: string
  entries: StandingsEntry[]
}

export interface PerSquadStandings {
  scope: 'per_squad'
  standings: PerSquadStandingsGroup[]
}

type TournamentStandings = CombinedStandings | PerSquadStandings

export const standingsRouter = router({
  getBySquad: procedure
    .use(requireAuth)
    .input(z.string().uuid())
    .query(async ({ ctx, input }): Promise<StandingsEntry[]> => {
      const [squad] = await ctx.db
        .select({ id: squads.id })
        .from(squads)
        .where(eq(squads.id, input))
        .limit(1)

      if (!squad) throw new TRPCError({ code: 'NOT_FOUND', message: 'Squad not found' })

      const config = await getStageConfig(ctx.db, input)
      const rawEntries = await computeSquadStandings(ctx.db, input, config)
      return rankAndCut(rawEntries, config.tiebreakerRule, config.advanceCount)
    }),

  getByTournament: procedure
    .use(requireAuth)
    .input(z.string().uuid())
    .query(async ({ ctx, input }): Promise<TournamentStandings> => {
      const tournamentStages = await ctx.db
        .select()
        .from(stages)
        .where(eq(stages.tournamentId, input))
        .orderBy(asc(stages.sortOrder))

      if (tournamentStages.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tournament has no stages' })
      }

      const firstStage = tournamentStages[0]!
      const scope = firstStage.standingsScope as 'per_squad' | 'combined'

      const stageIds = tournamentStages.map((s) => s.id)
      const allSquads =
        stageIds.length > 0
          ? await ctx.db
              .select()
              .from(squads)
              .where(inArray(squads.stageId, stageIds))
              .orderBy(asc(squads.sortOrder))
          : []

      if (allSquads.length === 0) {
        return scope === 'combined'
          ? { scope: 'combined', standings: [] }
          : { scope: 'per_squad', standings: [] }
      }

      if (scope === 'combined') {
        const config = await getStageConfig(ctx.db, allSquads[0]!.id)
        const allEntries: StandingsEntry[] = []

        for (const squad of allSquads) {
          const entries = await computeSquadStandings(ctx.db, squad.id, config)
          allEntries.push(...entries)
        }

        return {
          scope: 'combined',
          standings: rankAndCut(allEntries, config.tiebreakerRule, config.advanceCount),
        }
      }

      const grouped: PerSquadStandingsGroup[] = await Promise.all(
        allSquads.map(async (squad) => {
          const config = await getStageConfig(ctx.db, squad.id)
          const rawEntries = await computeSquadStandings(ctx.db, squad.id, config)
          return {
            squadId: squad.id,
            squadName: squad.name,
            entries: rankAndCut(rawEntries, config.tiebreakerRule, config.advanceCount),
          }
        }),
      )

      return { scope: 'per_squad', standings: grouped }
    }),

  getPublic: procedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }): Promise<StandingsEntry[]> => {
      const [squad] = await ctx.db
        .select({ id: squads.id })
        .from(squads)
        .where(eq(squads.id, input))
        .limit(1)

      if (!squad) throw new TRPCError({ code: 'NOT_FOUND', message: 'Squad not found' })

      const config = await getStageConfig(ctx.db, input)
      const rawEntries = await computeSquadStandings(ctx.db, input, config)
      return rankAndCut(rawEntries, config.tiebreakerRule, config.advanceCount)
    }),
})
