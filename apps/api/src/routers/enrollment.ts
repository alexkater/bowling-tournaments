import { z } from 'zod'
import { eq, and, asc, sql } from 'drizzle-orm'
import { router, procedure } from '../trpc'
import { tournaments, tournamentPlayers, profiles } from '@bowling/db'
import { TRPCError } from '@trpc/server'
import { requireAuth } from '../middleware/auth'

export const enrollmentRouter = router({
  /**
   * Self-register the authenticated player to a published tournament.
   * If the tournament is at capacity and allows waitlisting, the player
   * is placed on the waitlist. Otherwise registration is rejected.
   */
  register: procedure
    .use(requireAuth)
    .input(z.object({ tournamentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { db, userId } = ctx

      // Look up the tournament
      const [tournament] = await db
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, input.tournamentId))
        .limit(1)

      if (!tournament || (tournament.status !== 'published' && tournament.status !== 'in_progress')) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tournament not found or not available for registration' })
      }

      // Check registration deadline
      if (tournament.registrationDeadline && new Date() > tournament.registrationDeadline) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Registration deadline has passed' })
      }

      // Verify the user has a profile
      const [profile] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, userId!))
        .limit(1)

      if (!profile) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Player profile not found' })
      }

      // Check for duplicate registration
      const [existing] = await db
        .select({ id: tournamentPlayers.id })
        .from(tournamentPlayers)
        .where(
          and(
            eq(tournamentPlayers.tournamentId, input.tournamentId),
            eq(tournamentPlayers.profileId, userId!),
          ),
        )
        .limit(1)

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'You are already registered for this tournament' })
      }

      // Count confirmed registrations for capacity check
      const confirmed = await db.$count(
        tournamentPlayers,
        and(
          eq(tournamentPlayers.tournamentId, input.tournamentId),
          eq(tournamentPlayers.status, 'confirmed'),
        ),
      )

      const atCapacity = tournament.maxPlayers != null && confirmed >= tournament.maxPlayers
      const status: 'confirmed' | 'waitlisted' = atCapacity && tournament.allowWaitlist ? 'waitlisted' : 'confirmed'

      if (atCapacity && !tournament.allowWaitlist) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Tournament is full' })
      }

      // Get a squad to assign (pick the earliest one)
      const [squad] = await db.execute(
        sql`SELECT s.id FROM squads s
            JOIN stages st ON st.id = s."stageId"
            WHERE st."tournamentId" = ${input.tournamentId}
            ORDER BY s."date" ASC, s."startTime" ASC
            LIMIT 1`,
      )

      const squadId = (squad as any)?.id

      // Insert the registration
      const [entry] = await db
        .insert(tournamentPlayers)
        .values({
          tournamentId: input.tournamentId,
          profileId: userId!,
          squadId: squadId ?? '', // squadId is NOT NULL — fallback empty string (should never happen if tournament is valid)
          status,
        })
        .returning()

      if (!entry) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to register' })
      }

      // ── Notifications & email ──
      const { createNotification } = await import('../services/notifications')
      const { sendEmail } = await import('../services/email')

      const [playerProfile] = await db
        .select({ email: profiles.email, firstName: profiles.firstName })
        .from(profiles)
        .where(eq(profiles.id, userId!))
        .limit(1)

      const notifTitle = status === 'confirmed'
        ? `Inscripción confirmada en ${tournament.name}`
        : `Lista de espera en ${tournament.name}`

      const notifBody = status === 'confirmed'
        ? 'Tu inscripción ha sido confirmada. ¡Buena suerte!'
        : 'El torneo está lleno. Te avisaremos si se libera un cupo.'

      await createNotification({
        db, profileId: userId!,
        type: status === 'confirmed' ? 'enrollment_confirmed' : 'waitlisted',
        title: notifTitle,
        body: notifBody,
        metadata: { tournamentId: input.tournamentId },
      })

      if (playerProfile?.email) {
        await sendEmail({
          db, profileId: userId!, to: playerProfile.email,
          template: status === 'confirmed' ? 'enrollment_confirmed' : 'waitlisted',
          data: {
            firstName: playerProfile.firstName ?? '',
            tournamentName: tournament.name,
            startDate: tournament.startDate?.toISOString().split('T')[0] ?? '',
          },
        })
      }

      return entry
    }),

  /**
   * Cancel the authenticated player's registration.
   * If there are waitlisted players, the first one is promoted to confirmed.
   */
  cancel: procedure
    .use(requireAuth)
    .input(z.object({ tournamentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { db, userId } = ctx

      // Find the player's registration
      const [entry] = await db
        .select()
        .from(tournamentPlayers)
        .where(
          and(
            eq(tournamentPlayers.tournamentId, input.tournamentId),
            eq(tournamentPlayers.profileId, userId!),
          ),
        )
        .limit(1)

      if (!entry) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'You are not registered for this tournament' })
      }

      // Delete the registration
      await db
        .delete(tournamentPlayers)
        .where(eq(tournamentPlayers.id, entry.id))

      // Promote the first waitlisted player if this one was confirmed
      if (entry.status === 'confirmed') {
        const [waitlisted] = await db
          .select()
          .from(tournamentPlayers)
          .where(
            and(
              eq(tournamentPlayers.tournamentId, input.tournamentId),
              eq(tournamentPlayers.status, 'waitlisted'),
            ),
          )
          .orderBy(asc(tournamentPlayers.createdAt))
          .limit(1)

        if (waitlisted) {
          await db
            .update(tournamentPlayers)
            .set({ status: 'confirmed' })
            .where(eq(tournamentPlayers.id, waitlisted.id))

          // Notify promoted player
          const { createNotification } = await import('../services/notifications')
          const [promotedProfile] = await db
            .select({ email: profiles.email, firstName: profiles.firstName })
            .from(profiles)
            .where(eq(profiles.id, waitlisted.profileId))
            .limit(1)

          await createNotification({
            db, profileId: waitlisted.profileId,
            type: 'enrollment_confirmed',
            title: `¡Cupo liberado en ${input.tournamentId}!`,
            body: 'Pasaste de lista de espera a confirmado. ¡Buena suerte!',
            metadata: { tournamentId: input.tournamentId },
          })

          if (promotedProfile?.email) {
            const { sendEmail } = await import('../services/email')
            // Lightweight tournament name lookup
            const [t] = await db.select({ name: tournaments.name }).from(tournaments).where(eq(tournaments.id, input.tournamentId)).limit(1)
            await sendEmail({
              db, profileId: waitlisted.profileId, to: promotedProfile.email,
              template: 'enrollment_confirmed',
              data: { firstName: promotedProfile.firstName ?? '', tournamentName: t?.name ?? '', startDate: '' },
            })
          }
        }
      }

      return { cancelled: true, wasConfirmed: entry.status === 'confirmed' }
    }),

  /**
   * List all tournament registrations for the authenticated player,
   * including both confirmed and waitlisted entries.
   */
  myTournaments: procedure
    .use(requireAuth)
    .query(async ({ ctx }) => {
      const { db, userId } = ctx

      const rows = await db
        .select({
          id: tournamentPlayers.id,
          tournamentId: tournamentPlayers.tournamentId,
          profileId: tournamentPlayers.profileId,
          squadId: tournamentPlayers.squadId,
          status: tournamentPlayers.status,
          checkedIn: tournamentPlayers.checkedIn,
          createdAt: tournamentPlayers.createdAt,
          tournamentName: tournaments.name,
          tournamentStatus: tournaments.status,
          tournamentStartDate: tournaments.startDate,
          tournamentEndDate: tournaments.endDate,
        })
        .from(tournamentPlayers)
        .innerJoin(tournaments, eq(tournamentPlayers.tournamentId, tournaments.id))
        .where(eq(tournamentPlayers.profileId, userId!))
        .orderBy(asc(tournaments.startDate))

      return rows
    }),
})
