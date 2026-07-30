import { z } from 'zod'
import { eq, and, desc, ilike, or, inArray } from 'drizzle-orm'
import { router, procedure } from '../trpc'
import { profiles, tournamentPlayers, tournaments, squads, games, paymentTransactions } from '@bowling/db'
import { TRPCError } from '@trpc/server'

export const playerRouter = router({
  /**
   * Get a player profile by ID.
   * Returns full profile including average, usbcId, handicap, etc.
   * Throws NOT_FOUND if the profile does not exist.
   */
  getProfile: procedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const [profile] = await ctx.db
        .select()
        .from(profiles)
        .where(eq(profiles.id, input))
        .limit(1)

      if (!profile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Player profile not found' })
      }

      return profile
    }),

  /**
   * Update a player profile.
   * Only the allowed fields (firstName, lastName, phone, usbcId, average)
   * are accepted. Throws NOT_FOUND if the profile does not exist.
   * Email and password changes are handled by Supabase Auth and are not
   * permitted here.
   */
  updateProfile: procedure
    .input(z.object({
      profileId: z.string(),
      data: z.object({
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
        phone: z.string().max(20).optional(),
        usbcId: z.string().max(50).optional(),
        average: z.number().int().min(0).max(300).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, input.profileId))
        .limit(1)

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Player profile not found' })
      }

      const updateData: Record<string, unknown> = {}
      if (input.data.firstName !== undefined) updateData.firstName = input.data.firstName
      if (input.data.lastName !== undefined) updateData.lastName = input.data.lastName
      if (input.data.phone !== undefined) updateData.phone = input.data.phone
      if (input.data.usbcId !== undefined) updateData.usbcId = input.data.usbcId
      if (input.data.average !== undefined) updateData.average = input.data.average

      const [updated] = await ctx.db
        .update(profiles)
        .set(updateData)
        .where(eq(profiles.id, input.profileId))
        .returning()

      return updated
    }),

  /**
   * List all tournaments a player is registered in.
   * Returns tournament info (name, status, dates), assigned squad,
   * and a summary of game scores if any have been entered.
   * Throws NOT_FOUND if the profile does not exist.
   */
  getTournaments: procedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const [profile] = await ctx.db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, input))
        .limit(1)

      if (!profile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Player profile not found' })
      }

      const registrations = await ctx.db
        .select()
        .from(tournamentPlayers)
        .where(eq(tournamentPlayers.profileId, input))
        .orderBy(desc(tournamentPlayers.createdAt))

      if (registrations.length === 0) return []

      const tournamentIds = [...new Set(registrations.map((r) => r.tournamentId))]
      const squadIds = [...new Set(registrations.map((r) => r.squadId))]

      const [tournamentRows, squadRows] = await Promise.all([
        ctx.db
          .select()
          .from(tournaments)
          .where(inArray(tournaments.id, tournamentIds)),
        ctx.db
          .select()
          .from(squads)
          .where(inArray(squads.id, squadIds)),
      ])

      const tournamentMap = new Map(tournamentRows.map((t) => [t.id, t]))
      const squadMap = new Map(squadRows.map((s) => [s.id, s]))

      // Fetch games for score summary
      const registrationIds = registrations.map((r) => r.id)
      const gameRows =
        registrationIds.length > 0
          ? await ctx.db
              .select()
              .from(games)
              .where(inArray(games.tournamentPlayerId, registrationIds))
          : []

      const gamesByReg = new Map<string, (typeof gameRows)[number][]>()
      for (const game of gameRows) {
        const list = gamesByReg.get(game.tournamentPlayerId) ?? []
        list.push(game)
        gamesByReg.set(game.tournamentPlayerId, list)
      }

      return registrations.map((reg) => {
        const tournament = tournamentMap.get(reg.tournamentId)
        const squad = squadMap.get(reg.squadId)
        const regGames = gamesByReg.get(reg.id) ?? []
        const totalScore = regGames.reduce((sum, g) => sum + g.rawScore, 0)
        const hasHandicap = regGames.some((g) => g.handicapScore !== null)
        const totalHandicap = hasHandicap
          ? regGames.reduce((sum, g) => sum + (g.handicapScore ?? g.rawScore), 0)
          : null

        return {
          registrationId: reg.id,
          tournamentId: reg.tournamentId,
          tournamentName: tournament?.name ?? '',
          status: tournament?.status ?? '',
          startDate: tournament?.startDate ?? null,
          endDate: tournament?.endDate ?? null,
          squadName: squad?.name ?? '',
          checkedIn: reg.checkedIn,
          lane: reg.lane,
          totalScore,
          totalHandicapScore: totalHandicap,
          gamesCount: regGames.length,
        }
      })
    }),

  /**
   * Get detailed tournament history for a player.
   * Returns every tournament the player entered with individual game
   * scores, total score, handicap score, ranking among all participants,
   * and winnings (payouts in cents).
   * Throws NOT_FOUND if the profile does not exist.
   */
  getHistory: procedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const [profile] = await ctx.db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, input))
        .limit(1)

      if (!profile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Player profile not found' })
      }

      const registrations = await ctx.db
        .select()
        .from(tournamentPlayers)
        .where(eq(tournamentPlayers.profileId, input))
        .orderBy(desc(tournamentPlayers.createdAt))

      if (registrations.length === 0) return []

      const tournamentIds = [...new Set(registrations.map((r) => r.tournamentId))]
      const registrationIds = registrations.map((r) => r.id)
      const squadIds = [...new Set(registrations.map((r) => r.squadId))]

      const [tournamentRows, squadRows, gameRows, paymentRows] = await Promise.all([
        ctx.db
          .select()
          .from(tournaments)
          .where(inArray(tournaments.id, tournamentIds)),
        ctx.db
          .select()
          .from(squads)
          .where(inArray(squads.id, squadIds)),
        ctx.db
          .select()
          .from(games)
          .where(inArray(games.tournamentPlayerId, registrationIds))
          .orderBy(games.gameNumber),
        ctx.db
          .select()
          .from(paymentTransactions)
          .where(
            and(
              inArray(paymentTransactions.tournamentPlayerId, registrationIds),
              eq(paymentTransactions.type, 'payout'),
            ),
          ),
      ])

      const tournamentMap = new Map(tournamentRows.map((t) => [t.id, t]))
      const squadMap = new Map(squadRows.map((s) => [s.id, s]))

      const gamesByReg = new Map<string, (typeof gameRows)[number][]>()
      for (const game of gameRows) {
        const list = gamesByReg.get(game.tournamentPlayerId) ?? []
        list.push(game)
        gamesByReg.set(game.tournamentPlayerId, list)
      }

      const paymentsByReg = new Map<string, (typeof paymentRows)[number][]>()
      for (const pmt of paymentRows) {
        const list = paymentsByReg.get(pmt.tournamentPlayerId) ?? []
        list.push(pmt)
        paymentsByReg.set(pmt.tournamentPlayerId, list)
      }

      // ── Compute ranking within each tournament ──────────────────
      const allTournamentPlayers = await ctx.db
        .select({ id: tournamentPlayers.id, tournamentId: tournamentPlayers.tournamentId })
        .from(tournamentPlayers)
        .where(inArray(tournamentPlayers.tournamentId, tournamentIds))

      const allTPIds = allTournamentPlayers.map((tp) => tp.id)
      const allGameScores: Array<{ tournamentPlayerId: string; rawScore: number }> =
        allTPIds.length > 0
          ? await ctx.db
              .select({
                tournamentPlayerId: games.tournamentPlayerId,
                rawScore: games.rawScore,
              })
              .from(games)
              .where(inArray(games.tournamentPlayerId, allTPIds))
          : []

      const totalScoreByTP = new Map<string, number>()
      for (const g of allGameScores) {
        totalScoreByTP.set(g.tournamentPlayerId, (totalScoreByTP.get(g.tournamentPlayerId) ?? 0) + g.rawScore)
      }

      const tpsByTournament = new Map<string, (typeof allTournamentPlayers)[number][]>()
      for (const tp of allTournamentPlayers) {
        const list = tpsByTournament.get(tp.tournamentId) ?? []
        list.push(tp)
        tpsByTournament.set(tp.tournamentId, list)
      }

      const rankByReg = new Map<string, number>()
      const totalParticipantsByTournament = new Map<string, number>()
      for (const [tid, tps] of tpsByTournament) {
        totalParticipantsByTournament.set(tid, tps.length)
        const sorted = [...tps].sort((a, b) => {
          return (totalScoreByTP.get(b.id) ?? 0) - (totalScoreByTP.get(a.id) ?? 0)
        })
        let rank = 0
        let prevScore: number | null = null
        for (let i = 0; i < sorted.length; i++) {
          const score = totalScoreByTP.get(sorted[i]!.id) ?? 0
          if (prevScore === null || score < prevScore) {
            rank = i + 1
          }
          rankByReg.set(sorted[i]!.id, rank)
          prevScore = score
        }
      }

      // ── Build results ──────────────────────────────────────────
      return registrations.map((reg) => {
        const tournament = tournamentMap.get(reg.tournamentId)
        const squad = squadMap.get(reg.squadId)
        const regGames = gamesByReg.get(reg.id) ?? []
        const totalScore = regGames.reduce((sum, g) => sum + g.rawScore, 0)
        const hasHandicap = regGames.some((g) => g.handicapScore !== null)
        const totalHandicap = hasHandicap
          ? regGames.reduce((sum, g) => sum + (g.handicapScore ?? g.rawScore), 0)
          : null
        const regPayments = paymentsByReg.get(reg.id) ?? []
        const winnings = regPayments.reduce((sum, p) => sum + Math.abs(p.amount), 0)

        return {
          tournamentId: reg.tournamentId,
          tournamentName: tournament?.name ?? '',
          status: tournament?.status ?? '',
          startDate: tournament?.startDate ?? null,
          endDate: tournament?.endDate ?? null,
          squadName: squad?.name ?? '',
          registrationId: reg.id,
          scores: regGames.map((g) => ({
            gameNumber: g.gameNumber,
            rawScore: g.rawScore,
            handicapScore: g.handicapScore,
          })),
          totalScore,
          totalHandicapScore: totalHandicap,
          rank: regGames.length > 0 ? (rankByReg.get(reg.id) ?? null) : null,
          totalParticipants: totalParticipantsByTournament.get(reg.tournamentId) ?? 0,
          winnings,
        }
      })
    }),

  /**
   * Search players by name. Performs a case-insensitive substring match
   * against firstName and lastName. Returns at most 20 results.
   * Useful for organizers to find and register players.
   */
  search: procedure
    .input(z.string().min(1))
    .query(async ({ ctx, input }) => {
      const pattern = `%${input}%`

      const results = await ctx.db
        .select({
          id: profiles.id,
          firstName: profiles.firstName,
          lastName: profiles.lastName,
          email: profiles.email,
          phone: profiles.phone,
          usbcId: profiles.usbcId,
          average: profiles.average,
          handicap: profiles.handicap,
          avatarUrl: profiles.avatarUrl,
        })
        .from(profiles)
        .where(
          or(
            ilike(profiles.firstName, pattern),
            ilike(profiles.lastName, pattern),
          ),
        )
        .limit(20)

      return results
    }),
})
