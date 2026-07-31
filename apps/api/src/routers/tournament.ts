import { z } from 'zod'
import { eq, desc, and, inArray } from 'drizzle-orm'
import { router, procedure } from '../trpc'
import { TournamentBaseSchema, validateTournament } from '@bowling/shared'
import { tournaments, stages, tournamentPlayers, squads, profiles } from '@bowling/db'
import { TRPCError } from '@trpc/server'
import postgres from 'postgres'
import type { TournamentInput } from '@bowling/shared'
import { requireOrgAccess, requireOrgRole } from '../middleware/auth'
import { organizerByIdProcedure, organizerListProcedure } from './tournament-organizer'

export const tournamentRouter = router({
  list: procedure
    .input(z.object({
      status: z.enum(['published', 'in_progress', 'completed']).default('published'),
      limit: z.number().default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db
        .select()
        .from(tournaments)
        .where(eq(tournaments.status, input.status))
        .orderBy(desc(tournaments.createdAt))
        .limit(input.limit)

      return {
        items,
        nextCursor: items.length === input.limit ? items[items.length - 1]?.id ?? null : null,
      }
    }),

  byId: procedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const tournament = await ctx.db
        .select()
        .from(tournaments)
        .where(
          and(
            eq(tournaments.id, input),
            inArray(tournaments.status, ['published', 'in_progress', 'completed']),
          ),
        )
        .limit(1)

      if (!tournament.length) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tournament not found' })
      }

      const tournamentStages = await ctx.db
        .select()
        .from(stages)
        .where(eq(stages.tournamentId, input))
        .orderBy(stages.sortOrder)

      const data = tournament[0]
      if (!data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tournament not found' })
      return { ...data, stages: tournamentStages }
    }),

  organizerList: organizerListProcedure,

  organizerById: organizerByIdProcedure,

  create: procedure
    .use(requireOrgAccess)
    .use(requireOrgRole(['owner', 'admin']))
    .input(TournamentBaseSchema)
    .mutation(async ({ ctx, input }) => {
      const errors = validateTournament(input as TournamentInput)
      if (errors.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: errors.map((e) => e.message).join('; '),
        })
      }

      const tournamentId = await ctx.db.transaction(async (tx) => {
        const [tournament] = await tx
          .insert(tournaments)
          .values({
            organizationId: ctx.orgId,
            name: input.name,
            description: input.description,
            category: input.category,
            status: input.status,
            maxPlayers: input.maxPlayers,
            allowWaitlist: input.allowWaitlist,
            startDate: new Date(input.startDate),
            endDate: new Date(input.endDate),
            registrationDeadline: input.registrationDeadline
              ? new Date(input.registrationDeadline)
              : null,
          })
          .returning()

        if (!tournament) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create tournament' })
        }

        // Insert stages
        const createdStages = await tx.insert(stages).values(input.stages.map((stage) => ({
          tournamentId: tournament.id,
          name: stage.name,
          sortOrder: stage.order,
          format: stage.format as Record<string, unknown>,
          advancement: stage.advancement as Record<string, unknown>,
          squadConfig: stage.squadConfig as Record<string, unknown> | null,
          standingsScope: stage.standingsScope ?? 'per_squad',
        }))).returning()

        // Auto-create squads for each stage based on squadConfig
        for (const stage of createdStages) {
          const config = (stage.squadConfig as { count?: number; label?: string }) ?? {}
          const count = config.count ?? 1
          const label = config.label ?? 'Squad'
          for (let i = 1; i <= count; i++) {
            await tx.insert(squads).values({
              stageId: stage.id,
              name: count === 1 ? label : `${label} ${i}`,
              date: tournament.startDate,
              startTime: '10:00',
              sortOrder: i - 1,
            })
          }
        }

        return tournament.id
      })

      return { id: tournamentId }
    }),

  update: procedure
    .use(requireOrgAccess)
    .use(requireOrgRole(['owner', 'admin']))
    .input(z.object({
      id: z.string().uuid(),
      data: TournamentBaseSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: tournaments.id })
        .from(tournaments)
        .where(
          and(
            eq(tournaments.id, input.id),
            eq(tournaments.organizationId, ctx.orgId),
          ),
        )
        .limit(1)

      if (!existing.length) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tournament not found' })
      }

      if (input.data.startDate || input.data.endDate || input.data.registrationDeadline !== undefined) {
        const errors = validateTournament({
          name: 'temp',
          startDate: input.data.startDate ?? new Date(0).toISOString(),
          endDate: input.data.endDate ?? new Date(0).toISOString(),
          registrationDeadline: input.data.registrationDeadline ?? null,
          stages: [{ name: 'temp', order: 0, format: { type: 'total_pins', gamesPerPlayer: 3, eventType: 'singles' as const, scoring: { type: 'scratch' as const, noTap: false } }, advancement: { type: 'final' as const } }],
        })
        const dateErrors = errors.filter((e) => e.path === 'startDate' || e.path === 'endDate' || e.path === 'registrationDeadline')
        if (dateErrors.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: dateErrors.map((e) => e.message).join('; '),
          })
        }
      }
      const updateData: Record<string, unknown> = {}
      if (input.data.name !== undefined) updateData.name = input.data.name
      if (input.data.description !== undefined) updateData.description = input.data.description
      if (input.data.category !== undefined) updateData.category = input.data.category
      if (input.data.status !== undefined) updateData.status = input.data.status
      if (input.data.maxPlayers !== undefined) updateData.maxPlayers = input.data.maxPlayers
      if (input.data.allowWaitlist !== undefined) updateData.allowWaitlist = input.data.allowWaitlist
      if (input.data.startDate !== undefined) updateData.startDate = new Date(input.data.startDate)
      if (input.data.endDate !== undefined) updateData.endDate = new Date(input.data.endDate)
      if (input.data.registrationDeadline !== undefined) {
        updateData.registrationDeadline = input.data.registrationDeadline
          ? new Date(input.data.registrationDeadline)
          : null
      }

      await ctx.db
        .update(tournaments)
        .set(updateData)
        .where(
          and(
            eq(tournaments.id, input.id),
            eq(tournaments.organizationId, ctx.orgId),
          ),
        )

      return { success: true }
    }),

  /**
   * Register a player in a tournament squad.
   * Validates that the tournament, squad, and player exist before inserting.
   * Returns the created tournament player record.
   */
  registerPlayer: procedure
    .use(requireOrgAccess)
    .use(requireOrgRole(['owner', 'admin']))
    .input(z.object({
      tournamentId: z.string().uuid(),
      squadId: z.string().uuid(),
      playerId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify tournament exists
      const [tournament] = await ctx.db
        .select({ id: tournaments.id })
        .from(tournaments)
        .where(
          and(
            eq(tournaments.id, input.tournamentId),
            eq(tournaments.organizationId, ctx.orgId),
          ),
        )
        .limit(1)

      if (!tournament) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tournament not found' })
      }

      // Verify squad exists and belongs to this tournament
      const [squad] = await ctx.db
        .select({ id: squads.id })
        .from(squads)
        .innerJoin(stages, eq(squads.stageId, stages.id))
        .where(and(eq(squads.id, input.squadId), eq(stages.tournamentId, input.tournamentId)))
        .limit(1)

      if (!squad) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Squad not found in this tournament' })
      }

      // Verify player profile exists
      const [profile] = await ctx.db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, input.playerId))
        .limit(1)

      if (!profile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Player profile not found' })
      }

      // Check for duplicate registration
      const [existing] = await ctx.db
        .select({ id: tournamentPlayers.id })
        .from(tournamentPlayers)
        .where(
          and(
            eq(tournamentPlayers.tournamentId, input.tournamentId),
            eq(tournamentPlayers.profileId, input.playerId),
          ),
        )
        .limit(1)

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Player is already registered in this tournament' })
      }

      const [tp] = await ctx.db
        .insert(tournamentPlayers)
        .values({
          tournamentId: input.tournamentId,
          profileId: input.playerId,
          squadId: input.squadId,
        })
        .returning()
        .catch((error: unknown) => {
          const postgresError = error instanceof postgres.PostgresError
            ? error
            : typeof error === 'object' && error !== null && 'cause' in error
              && error.cause instanceof postgres.PostgresError
              ? error.cause
              : null

          if (postgresError?.code === '23505') {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Player is already registered in this tournament',
            })
          }
          throw error
        })

      if (!tp) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to register player' })
      }

      return tp
    }),
})
