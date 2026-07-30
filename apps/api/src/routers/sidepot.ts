import { z } from 'zod'
import { eq, count } from 'drizzle-orm'
import { router, procedure } from '../trpc'
import { sidepots, sidepotEntries } from '@bowling/db'
import { TRPCError } from '@trpc/server'
import {
  calculateHighGame,
  calculateHighSeries,
  calculateEliminatorCut,
  calculateBigDog,
  generateBlindDrawPairs,
  calculateHandicap,
} from '@bowling/shared'
import type { HandicapConfig } from '@bowling/shared'
import {
  getSidepotOrThrow,
  getEntriesForSidepot,
  buildPlayerScores,
  computePrizes,
  createSidepot as createSidepotService,
  joinSidepot as joinSidepotService,
} from '../services/sidepot.service'

const DEFAULT_HANDICAP_CONFIG: HandicapConfig = {
  base: 220,
  percentage: 80,
  max: null,
}

const SidepotConfigSchema = z.object({
  handicap: z.boolean().default(false),
  maxEntries: z.number().int().nullable().default(null),
  payoutRatio: z.number().default(0.8),
  gamesIncluded: z.array(z.number().int()).default([1, 2, 3]),
  gender: z.enum(['all', 'male', 'female']).nullable().default('all'),
})

const CreateSidepotSchema = z.object({
  tournamentId: z.string(),
  name: z.string().min(1),
  type: z.enum([
    'high_game',
    'high_series',
    'eliminator',
    'mystery_doubles',
    'sweeper_doubles',
    'big_dog',
    'blind_draw',
  ]),
  entryFee: z.number().int().default(0),
  config: SidepotConfigSchema.optional(),
})

export const sidepotRouter = router({
  list: procedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: sidepots.id,
          tournamentId: sidepots.tournamentId,
          name: sidepots.name,
          type: sidepots.type,
          entryFee: sidepots.entryFee,
          config: sidepots.config,
          status: sidepots.status,
          createdAt: sidepots.createdAt,
          updatedAt: sidepots.updatedAt,
          entryCount: count(sidepotEntries.id),
        })
        .from(sidepots)
        .leftJoin(sidepotEntries, eq(sidepotEntries.sidepotId, sidepots.id))
        .where(eq(sidepots.tournamentId, input.tournamentId))
        .groupBy(sidepots.id)
        .orderBy(sidepots.createdAt)

      return { items: rows }
    }),

  create: procedure
    .input(CreateSidepotSchema)
    .mutation(async ({ ctx, input }) => {
      const config = {
        handicap: input.config?.handicap ?? false,
        maxEntries: input.config?.maxEntries ?? null,
        payoutRatio: input.config?.payoutRatio ?? 0.8,
        gamesIncluded: input.config?.gamesIncluded ?? [1, 2, 3],
        gender: input.config?.gender ?? 'all',
      }
      return createSidepotService(ctx.db, {
        tournamentId: input.tournamentId,
        name: input.name,
        type: input.type,
        entryFee: input.entryFee,
        config,
      })
    }),

  join: procedure
    .input(z.object({ sidepotId: z.string(), tournamentPlayerId: z.string() }))
    .mutation(async ({ ctx, input }) => joinSidepotService(ctx.db, input)),

  calculateResults: procedure
    .input(z.string())
    .query(async ({ ctx, input: sidepotId }) => {
      const sidepot = await getSidepotOrThrow(ctx.db, sidepotId)
      const entries = await getEntriesForSidepot(ctx.db, sidepotId)
      const tpIds = entries.map((e) => e.tournamentPlayerId)
      const playerScores = await buildPlayerScores(ctx.db, tpIds)
      const config = sidepot.config as {
        handicap: boolean; maxEntries: number | null; payoutRatio: number
        gamesIncluded: number[]; gender: 'all' | 'male' | 'female' | null
      }

      const handicapCfg = config.handicap ? DEFAULT_HANDICAP_CONFIG : undefined

      const base = {
        sidepotId: sidepot.id,
        sidepotType: sidepot.type,
        sidepotName: sidepot.name,
        config,
        entryCount: entries.length,
        entryFee: sidepot.entryFee,
      }

      switch (sidepot.type) {
        case 'high_game': {
          const gameNumber = (config.gamesIncluded[0] ?? 1)
          const result = calculateHighGame(playerScores, gameNumber, config.handicap, handicapCfg)
          const { prizePool, payout } = computePrizes(sidepot.entryFee, entries.length, config.payoutRatio, result.winners.length)
          return { ...base, gameNumber, ...result, winners: result.winners.map((w) => ({ ...w, prize: payout })), prizePool }
        }
        case 'high_series': {
          const result = calculateHighSeries(playerScores, config.gamesIncluded, config.handicap, handicapCfg)
          const { prizePool, payout } = computePrizes(sidepot.entryFee, entries.length, config.payoutRatio, result.winners.length)
          return { ...base, gamesIncluded: config.gamesIncluded, ...result, winners: result.winners.map((w) => ({ ...w, prize: payout })), prizePool }
        }
        case 'big_dog': {
          const result = calculateBigDog(playerScores)
          const { prizePool, payout } = computePrizes(sidepot.entryFee, entries.length, config.payoutRatio, result.winners.length)
          return { ...base, ...result, winners: result.winners.map((w) => ({ ...w, prize: payout })), prizePool }
        }
        case 'eliminator': {
          let remaining = [...playerScores]
          const rounds: Array<{ gameNumber: number; advancing: string[]; eliminated: string[] }> = []
          for (const gameNum of config.gamesIncluded) {
            if (remaining.length <= 1) break
            const advanceCount = Math.max(1, Math.ceil(remaining.length / 2))
            const cut = calculateEliminatorCut(remaining, gameNum, advanceCount, config.handicap, handicapCfg)
            rounds.push({ gameNumber: gameNum, advancing: cut.advancing, eliminated: cut.eliminated })
            remaining = remaining.filter((p) => cut.advancing.includes(p.playerId))
          }
          const { prizePool, payout } = computePrizes(sidepot.entryFee, entries.length, config.payoutRatio, remaining.length)
          return { ...base, rounds, winners: remaining.map((p) => ({ playerId: p.playerId, score: 0, prize: payout })), prizePool }
        }
        case 'blind_draw': {
          const playerIds = playerScores.map((p) => p.playerId)
          const pairs = generateBlindDrawPairs(playerIds)
          const scoredPairs = pairs.map(([p1Id, p2Id]) => {
            const p1 = playerScores.find((p) => p.playerId === p1Id)
            const p2 = playerScores.find((p) => p.playerId === p2Id)
            if (!p1 || !p2) return { pair: [p1Id, p2Id] as [string, string], totalScore: 0 }
            const p1Hcp = config.handicap ? calculateHandicap(p1.average, DEFAULT_HANDICAP_CONFIG) * config.gamesIncluded.length : 0
            const p2Hcp = config.handicap ? calculateHandicap(p2.average, DEFAULT_HANDICAP_CONFIG) * config.gamesIncluded.length : 0
            const p1Total = config.gamesIncluded.reduce((s, g) => s + (p1.scores[g - 1] ?? 0), 0) + p1Hcp
            const p2Total = config.gamesIncluded.reduce((s, g) => s + (p2.scores[g - 1] ?? 0), 0) + p2Hcp
            return { pair: [p1Id, p2Id] as [string, string], totalScore: p1Total + p2Total }
          })
          scoredPairs.sort((a, b) => b.totalScore - a.totalScore)
          const bestScore = scoredPairs[0]?.totalScore ?? 0
          const topPairs = scoredPairs.filter((sp) => sp.totalScore === bestScore)
          const { prizePool, payout } = computePrizes(sidepot.entryFee, entries.length, config.payoutRatio, topPairs.length)
          return { ...base, pairs: scoredPairs, winners: topPairs.map((p) => ({ ...p, prize: payout })), prizePool }
        }
        case 'mystery_doubles':
        case 'sweeper_doubles': {
          const gameRounds = config.gamesIncluded.map((gameNum) => {
            const eligible = playerScores.filter((p) => p.scores[gameNum - 1] !== undefined)
            const pairs = generateBlindDrawPairs(eligible.map((p) => p.playerId))
            const scoredPairs = pairs.map(([p1Id, p2Id]) => {
              const p1 = eligible.find((p) => p.playerId === p1Id)
              const p2 = eligible.find((p) => p.playerId === p2Id)
              if (!p1 || !p2) return { pair: [p1Id, p2Id] as [string, string], totalScore: 0 }
              const p1Hcp = config.handicap ? calculateHandicap(p1.average, DEFAULT_HANDICAP_CONFIG) : 0
              const p2Hcp = config.handicap ? calculateHandicap(p2.average, DEFAULT_HANDICAP_CONFIG) : 0
              const p1Score = (p1.scores[gameNum - 1] ?? 0) + p1Hcp
              const p2Score = (p2.scores[gameNum - 1] ?? 0) + p2Hcp
              return { pair: [p1Id, p2Id] as [string, string], totalScore: p1Score + p2Score }
            })
            scoredPairs.sort((a, b) => b.totalScore - a.totalScore)
            return { gameNumber: gameNum, pairs: scoredPairs }
          })
          const { prizePool, payout } = computePrizes(sidepot.entryFee, entries.length, config.payoutRatio, 1)
          return { ...base, rounds: gameRounds, prizePool, payout }
        }
        default:
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Unknown sidepot type: ${sidepot.type}` })
      }
    }),

  getWinners: procedure
    .input(z.string())
    .query(async ({ ctx, input: sidepotId }) => {
      const sidepot = await getSidepotOrThrow(ctx.db, sidepotId)
      const entries = await getEntriesForSidepot(ctx.db, sidepotId)
      const tpIds = entries.map((e) => e.tournamentPlayerId)
      const playerScores = await buildPlayerScores(ctx.db, tpIds)
      const config = sidepot.config as {
        handicap: boolean; maxEntries: number | null; payoutRatio: number
        gamesIncluded: number[]; gender: 'all' | 'male' | 'female' | null
      }

      const handicapCfg = config.handicap ? DEFAULT_HANDICAP_CONFIG : undefined

      switch (sidepot.type) {
        case 'high_game': {
          const gameNumber = config.gamesIncluded[0] ?? 1
          const result = calculateHighGame(playerScores, gameNumber, config.handicap, handicapCfg)
          return { sidepotType: sidepot.type, gameNumber, ...result }
        }
        case 'high_series': {
          const result = calculateHighSeries(playerScores, config.gamesIncluded, config.handicap, handicapCfg)
          return { sidepotType: sidepot.type, ...result }
        }
        case 'big_dog': {
          const result = calculateBigDog(playerScores)
          return { sidepotType: sidepot.type, ...result }
        }
        case 'eliminator': {
          let remaining = [...playerScores]
          for (const gameNum of config.gamesIncluded) {
            if (remaining.length <= 1) break
            const advanceCount = Math.max(1, Math.ceil(remaining.length / 2))
            const cut = calculateEliminatorCut(remaining, gameNum, advanceCount, config.handicap, handicapCfg)
            remaining = remaining.filter((p) => cut.advancing.includes(p.playerId))
          }
          return { sidepotType: sidepot.type, winners: remaining.map((p) => ({ playerId: p.playerId })) }
        }
        case 'blind_draw': {
          const playerIds = playerScores.map((p) => p.playerId)
          const pairs = generateBlindDrawPairs(playerIds)
          const scoredPairs = pairs.map(([p1Id, p2Id]) => {
            const p1 = playerScores.find((p) => p.playerId === p1Id)
            const p2 = playerScores.find((p) => p.playerId === p2Id)
            if (!p1 || !p2) return { pair: [p1Id, p2Id] as [string, string], totalScore: 0 }
            const p1Total = config.gamesIncluded.reduce((s, g) => s + (p1.scores[g - 1] ?? 0), 0)
            const p2Total = config.gamesIncluded.reduce((s, g) => s + (p2.scores[g - 1] ?? 0), 0)
            return { pair: [p1Id, p2Id] as [string, string], totalScore: p1Total + p2Total }
          })
          scoredPairs.sort((a, b) => b.totalScore - a.totalScore)
          return { sidepotType: sidepot.type, pairs: scoredPairs }
        }
        case 'mystery_doubles':
        case 'sweeper_doubles': {
          const rounds = config.gamesIncluded.map((gameNum) => {
            const eligible = playerScores.filter((p) => p.scores[gameNum - 1] !== undefined)
            const pairs = generateBlindDrawPairs(eligible.map((p) => p.playerId))
            const scoredPairs = pairs.map(([p1Id, p2Id]) => {
              const p1 = eligible.find((p) => p.playerId === p1Id)
              const p2 = eligible.find((p) => p.playerId === p2Id)
              if (!p1 || !p2) return { pair: [p1Id, p2Id] as [string, string], totalScore: 0 }
              const p1Score = p1.scores[gameNum - 1] ?? 0
              const p2Score = p2.scores[gameNum - 1] ?? 0
              return { pair: [p1Id, p2Id] as [string, string], totalScore: p1Score + p2Score }
            })
            scoredPairs.sort((a, b) => b.totalScore - a.totalScore)
            return { gameNumber: gameNum, pairs: scoredPairs }
          })
          return { sidepotType: sidepot.type, rounds }
        }
        default:
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Unknown sidepot type: ${sidepot.type}` })
      }
    }),
})
