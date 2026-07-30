import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { router, procedure } from '../trpc'
import {
  bracketPools,
  bracketRounds,
  bracketMatches,
  bracketEntries,
  tournamentPlayers,
} from '@bowling/db'
import {
  fairnessShuffle,
  advanceEliminator,
  buildNextRound,
  forwardMatchups,
  reverseMatchups,
  calculatePayouts,
  transition,
} from '@bowling/shared'
import { TRPCError } from '@trpc/server'

type BracketUtilType = 'forward' | 'reverse' | 'eliminator'

function toBracketUtilType(type: string): BracketUtilType {
  switch (type) {
    case 'eight_person_reverse':
      return 'reverse'
    case 'eight_person_eliminator':
      return 'eliminator'
    default:
      // eight_person_forward, single_elimination, double_elimination
      return 'forward'
  }
}

export const bracketRouter = router({
  list: procedure
    .input(z.object({ tournamentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const pools = await ctx.db
        .select()
        .from(bracketPools)
        .where(eq(bracketPools.tournamentId, input.tournamentId))
        .orderBy(desc(bracketPools.createdAt))

      const enriched = await Promise.all(
        pools.map(async (pool) => {
          const entries = await ctx.db
            .select({ id: bracketEntries.id })
            .from(bracketEntries)
            .where(eq(bracketEntries.bracketPoolId, pool.id))

          return { ...pool, currentPlayers: entries.length }
        }),
      )

      return enriched
    }),

  createPool: procedure
    .input(
      z.object({
        tournamentId: z.string().uuid(),
        name: z.string().min(1).max(100),
        type: z.enum([
          'eight_person_forward',
          'eight_person_reverse',
          'eight_person_eliminator',
          'single_elimination',
          'double_elimination',
        ]),
        entryFee: z.number().int().min(0).default(0),
        maxPlayers: z.number().int().min(2).default(8),
        config: z
          .object({
            handicap: z.boolean().default(false),
            allowMultipleEntries: z.boolean().default(true),
            maxEntriesPerPlayer: z.number().int().min(1).default(5),
            payoutRatio: z.number().min(0).max(1).default(0.8),
            bracketSize: z.number().int().default(8),
          })
          .default({}),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [pool] = await ctx.db
        .insert(bracketPools)
        .values({
          tournamentId: input.tournamentId,
          name: input.name,
          type: input.type,
          entryFee: input.entryFee,
          maxPlayers: input.maxPlayers,
          config: {
            handicap: input.config.handicap,
            allowMultipleEntries: input.config.allowMultipleEntries,
            maxEntriesPerPlayer: input.config.maxEntriesPerPlayer,
            payoutRatio: input.config.payoutRatio,
            bracketSize: input.config.bracketSize,
          },
        })
        .returning()

      if (!pool) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create bracket pool',
        })
      }

      return { id: pool.id }
    }),

  joinPool: procedure
    .input(
      z.object({
        poolId: z.string(),
        playerId: z.string(), // tournamentPlayerId
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [pool] = await ctx.db
        .select()
        .from(bracketPools)
        .where(eq(bracketPools.id, input.poolId))
        .limit(1)

      if (!pool) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bracket pool not found' })
      }

      if (pool.status !== 'open') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Pool is not open for joining',
        })
      }

      // Verify the tournament player exists and belongs to the pool's tournament
      const [tp] = await ctx.db
        .select()
        .from(tournamentPlayers)
        .where(eq(tournamentPlayers.id, input.playerId))
        .limit(1)

      if (!tp) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Player not found in tournament' })
      }

      if (tp.tournamentId !== pool.tournamentId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Player is not registered in this tournament',
        })
      }

      // Check pool capacity
      const allEntries = await ctx.db
        .select({ id: bracketEntries.id })
        .from(bracketEntries)
        .where(eq(bracketEntries.bracketPoolId, input.poolId))

      if (allEntries.length >= pool.maxPlayers) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pool is full' })
      }

      // Check per-player entry limits
      const playerEntries = await ctx.db
        .select({ id: bracketEntries.id })
        .from(bracketEntries)
        .where(
          and(
            eq(bracketEntries.bracketPoolId, input.poolId),
            eq(bracketEntries.tournamentPlayerId, input.playerId),
          ),
        )

      if (!pool.config.allowMultipleEntries && playerEntries.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Player already has an entry in this pool',
        })
      }

      if (pool.config.allowMultipleEntries && playerEntries.length >= pool.config.maxEntriesPerPlayer) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Player has reached maximum entries for this pool',
        })
      }

      const [entry] = await ctx.db
        .insert(bracketEntries)
        .values({
          bracketPoolId: input.poolId,
          tournamentPlayerId: input.playerId,
          entryNumber: playerEntries.length + 1,
          paid: false,
        })
        .returning()

      return entry
    }),

  shuffle: procedure
    .input(z.object({ poolId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [pool] = await ctx.db
        .select()
        .from(bracketPools)
        .where(eq(bracketPools.id, input.poolId))
        .limit(1)

      if (!pool) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bracket pool not found' })
      }

      // Validate state transition: open → shuffling
      const s1 = pool.status as 'open' | 'shuffling' | 'in_progress' | 'completed' | 'cancelled'
      transition('bracket', s1, 'shuffling')

      const entries = await ctx.db
        .select()
        .from(bracketEntries)
        .where(eq(bracketEntries.bracketPoolId, input.poolId))

      if (entries.length < 2) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Need at least 2 players to shuffle',
        })
      }

      const playerIds = entries.map((e) => e.tournamentPlayerId)
      const bracketType = toBracketUtilType(pool.type)
      const shuffled = fairnessShuffle(playerIds, bracketType, 50000)

      // Generate matchups based on bracket type
      let matchups: [string, string][]
      if (bracketType === 'reverse') {
        matchups = reverseMatchups(shuffled)
      } else if (bracketType === 'eliminator') {
        // Eliminator: pair sequentially; advancement uses aggregate scores
        matchups = reverseMatchups(shuffled)
      } else {
        // forward, single_elimination, double_elimination
        matchups = forwardMatchups(shuffled)
      }

      // Create first round
      const [round] = await ctx.db
        .insert(bracketRounds)
        .values({
          bracketPoolId: input.poolId,
          roundNumber: 1,
          completed: false,
        })
        .returning()

      if (!round) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create round' })
      }

      // Create matches for the round
      await ctx.db.insert(bracketMatches).values(
        matchups.map(([p1, p2], idx) => ({
          roundId: round.id,
          position: idx + 1,
          player1Id: p1,
          player2Id: p2,
        })),
      )

      // Transition: shuffling → in_progress
      transition('bracket', 'shuffling', 'in_progress')
      await ctx.db
        .update(bracketPools)
        .set({ status: 'in_progress', updatedAt: new Date() })
        .where(eq(bracketPools.id, input.poolId))

      return { success: true }
    }),

  enterScore: procedure
    .input(
      z.object({
        matchId: z.string(),
        player1Score: z.number().int().min(0),
        player2Score: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [match] = await ctx.db
        .select()
        .from(bracketMatches)
        .where(eq(bracketMatches.id, input.matchId))
        .limit(1)

      if (!match) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Match not found' })
      }

      if (match.winnerId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Match already has scores entered',
        })
      }

      // Determine winner: higher score wins; ties go to player1
      let winnerId: string | null = null
      if (match.player1Id && match.player2Id) {
        winnerId =
          input.player1Score >= input.player2Score
            ? match.player1Id
            : match.player2Id
      } else if (match.player1Id) {
        winnerId = match.player1Id
      } else if (match.player2Id) {
        winnerId = match.player2Id
      }

      const [updated] = await ctx.db
        .update(bracketMatches)
        .set({
          player1Score: input.player1Score,
          player2Score: input.player2Score,
          winnerId,
        })
        .where(eq(bracketMatches.id, input.matchId))
        .returning()

      return updated
    }),

  advanceRound: procedure
    .input(z.object({ poolId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [pool] = await ctx.db
        .select()
        .from(bracketPools)
        .where(eq(bracketPools.id, input.poolId))
        .limit(1)

      if (!pool) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bracket pool not found' })
      }

      if (pool.status !== 'in_progress') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Pool is not in progress',
        })
      }

      // Find the current active round (latest uncompleted)
      const [currentRound] = await ctx.db
        .select()
        .from(bracketRounds)
        .where(
          and(
            eq(bracketRounds.bracketPoolId, input.poolId),
            eq(bracketRounds.completed, false),
          ),
        )
        .orderBy(desc(bracketRounds.roundNumber))
        .limit(1)

      if (!currentRound) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No active round found' })
      }

      // Get all matches for this round
      const matches = await ctx.db
        .select()
        .from(bracketMatches)
        .where(eq(bracketMatches.roundId, currentRound.id))
        .orderBy(bracketMatches.position)

      // Verify all matches have a winner (scores entered)
      const incomplete = matches.filter((m) => !m.winnerId)
      if (incomplete.length > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Not all matches have scores entered',
        })
      }

      // Mark current round as completed
      await ctx.db
        .update(bracketRounds)
        .set({ completed: true })
        .where(eq(bracketRounds.id, currentRound.id))

      const bracketType = toBracketUtilType(pool.type)

      // Determine winners based on bracket type
      let winners: string[]
      if (bracketType === 'eliminator') {
        // Aggregate all scores across all matches in the round
        const scores = new Map<string, number>()
        for (const m of matches) {
          if (m.player1Id && m.player1Score !== null) scores.set(m.player1Id, m.player1Score)
          if (m.player2Id && m.player2Score !== null) scores.set(m.player2Id, m.player2Score)
        }
        const allPlayers = [...scores.keys()]
        const advanceCount = Math.max(1, Math.ceil(allPlayers.length / 2))
        winners = advanceEliminator(allPlayers, scores, advanceCount)
      } else {
        // Head-to-head: collect winners from each match
        winners = matches
          .map((m) => m.winnerId)
          .filter((id): id is string => id !== null)
      }

      // If 0 or 1 winner, the bracket is complete
      if (winners.length <= 1) {
        transition('bracket', 'in_progress', 'completed')
        await ctx.db
          .update(bracketPools)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(eq(bracketPools.id, input.poolId))

        return { success: true, completed: true, champion: winners[0] ?? null }
      }

      // Build next round matchups
      const nextMatchups = buildNextRound(winners, bracketType)

      // Create next round
      const [nextRound] = await ctx.db
        .insert(bracketRounds)
        .values({
          bracketPoolId: input.poolId,
          roundNumber: currentRound.roundNumber + 1,
          completed: false,
        })
        .returning()

      if (!nextRound) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create next round',
        })
      }

      // Create matches for the next round
      const insertedMatches = await ctx.db
        .insert(bracketMatches)
        .values(
          nextMatchups.map(([p1, p2], idx) => ({
            roundId: nextRound.id,
            position: idx + 1,
            player1Id: p1,
            player2Id: p2,
          })),
        )
        .returning()

      // Wire up nextMatchId / nextMatchPosition from previous matches to the new round
      for (let i = 0; i < matches.length; i++) {
        const parentIdx = Math.floor(i / 2)
        const nextMatch = insertedMatches[parentIdx]
        if (nextMatch) {
          await ctx.db
            .update(bracketMatches)
            .set({
              nextMatchId: nextMatch.id,
              nextMatchPosition: i % 2 === 0 ? 'top' : 'bottom',
            })
            .where(eq(bracketMatches.id, matches[i]!.id))
        }
      }

      return { success: true, completed: false }
    }),

  getBracket: procedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const [pool] = await ctx.db
        .select()
        .from(bracketPools)
        .where(eq(bracketPools.id, input))
        .limit(1)

      if (!pool) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bracket pool not found' })
      }

      const rounds = await ctx.db
        .select()
        .from(bracketRounds)
        .where(eq(bracketRounds.bracketPoolId, input))
        .orderBy(bracketRounds.roundNumber)

      const roundsWithMatches = await Promise.all(
        rounds.map(async (round) => {
          const matches = await ctx.db
            .select()
            .from(bracketMatches)
            .where(eq(bracketMatches.roundId, round.id))
            .orderBy(bracketMatches.position)

          return {
            roundNumber: round.roundNumber,
            completed: round.completed,
            matches,
          }
        }),
      )

      return {
        ...pool,
        rounds: roundsWithMatches,
      }
    }),

  calculatePayouts: procedure
    .input(z.object({ poolId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [pool] = await ctx.db
        .select()
        .from(bracketPools)
        .where(eq(bracketPools.id, input.poolId))
        .limit(1)

      if (!pool) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bracket pool not found' })
      }

      if (pool.status !== 'completed') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Pool must be completed before calculating payouts',
        })
      }

      const entries = await ctx.db
        .select({ id: bracketEntries.id })
        .from(bracketEntries)
        .where(eq(bracketEntries.bracketPoolId, input.poolId))

      const totalEntries = entries.length

      // Pay up to top 3 positions, capped at total entries
      const positions = Math.min(totalEntries, 3)

      const result = calculatePayouts(totalEntries, pool.entryFee, positions, {
        payoutRatio: pool.config.payoutRatio,
        rounding: 500,
        minPayout: 0,
      })

      return result
    }),
})
