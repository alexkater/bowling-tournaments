import { z } from 'zod';
import { eq, asc, inArray } from 'drizzle-orm';
import { router, procedure } from '../trpc';
import { squads, tournamentPlayers, stages } from '@bowling/db';
import { TRPCError } from '@trpc/server';
import { wsManager } from '../ws/manager';
import { enterScore as enterScoreService, getScoreSheet } from '../services/score.service';
import { requireOrgAccess, requireOrgRole } from '../middleware/auth';
import {
  assertSquadInOrganization,
  assertStageInOrganization,
  assertTournamentInOrganization,
  assertTournamentPlayersInOrganization,
} from '../services/tournament-resource-access';

const MAX_GAMES_PER_PLAYER = 12;
const MIN_SCORE = 0;
const MAX_SCORE = 300;

const ScoreEntrySchema = z.object({
  tournamentPlayerId: z.string().uuid(),
  gameNumber: z.number().int().min(1).max(MAX_GAMES_PER_PLAYER),
  rawScore: z.number().int().min(MIN_SCORE).max(MAX_SCORE),
  pins: z.array(z.number().int().min(0).max(10)).default([]),
});

const CreateSquadSchema = z.object({
  stageId: z.string().uuid(),
  name: z.string().min(1).max(100),
  date: z.string().datetime(),
  startTime: z.string(),
  laneStart: z.number().int().optional(),
  laneEnd: z.number().int().optional(),
  maxPlayers: z.number().int().optional(),
  sortOrder: z.number().int().default(0),
});

export const squadRouter = router({
  list: procedure
    .use(requireOrgAccess)
    .use(requireOrgRole(['owner', 'admin', 'scorer']))
    .input(z.object({ tournamentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertTournamentInOrganization(ctx.db, input.tournamentId, ctx.orgId);

      const rows = await ctx.db
        .select()
        .from(squads)
        .innerJoin(stages, eq(squads.stageId, stages.id))
        .where(eq(stages.tournamentId, input.tournamentId))
        .orderBy(asc(squads.sortOrder));

      return rows.map((r) => r.squads);
    }),

  byId: procedure
    .use(requireOrgAccess)
    .use(requireOrgRole(['owner', 'admin', 'scorer']))
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      await assertSquadInOrganization(ctx.db, input, ctx.orgId);

      const [squad] = await ctx.db.select().from(squads).where(eq(squads.id, input)).limit(1);

      if (!squad) throw new TRPCError({ code: 'NOT_FOUND', message: 'Squad not found' });

      const players = await ctx.db
        .select()
        .from(tournamentPlayers)
        .where(eq(tournamentPlayers.squadId, input));

      return { ...squad, players };
    }),

  create: procedure
    .use(requireOrgAccess)
    .use(requireOrgRole(['owner', 'admin']))
    .input(CreateSquadSchema)
    .mutation(async ({ ctx, input }) => {
      await assertStageInOrganization(ctx.db, input.stageId, ctx.orgId);

      const [stage] = await ctx.db
        .select({ id: stages.id })
        .from(stages)
        .where(eq(stages.id, input.stageId))
        .limit(1);

      if (!stage) throw new TRPCError({ code: 'NOT_FOUND', message: 'Stage not found' });

      const [squad] = await ctx.db
        .insert(squads)
        .values({
          stageId: input.stageId,
          name: input.name,
          date: new Date(input.date),
          startTime: input.startTime,
          laneStart: input.laneStart ?? null,
          laneEnd: input.laneEnd ?? null,
          maxPlayers: input.maxPlayers ?? null,
          sortOrder: input.sortOrder,
        })
        .returning();

      if (!squad) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create squad' });
      }

      return squad;
    }),

  enterScore: procedure
    .use(requireOrgAccess)
    .use(requireOrgRole(['owner', 'admin', 'scorer']))
    .input(ScoreEntrySchema)
    .mutation(async ({ ctx, input }) => {
      await assertTournamentPlayersInOrganization(ctx.db, [input.tournamentPlayerId], ctx.orgId);
      if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
      }

      const result = await ctx.db.transaction(async (tx) => {
        const [lockedPlayer] = await tx
          .select({ id: tournamentPlayers.id })
          .from(tournamentPlayers)
          .where(eq(tournamentPlayers.id, input.tournamentPlayerId))
          .for('update')
          .limit(1);
        if (!lockedPlayer) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tournament player not found' });
        }

        return enterScoreService(tx, input, {
          actorProfileId: ctx.userId,
          organizationId: ctx.orgId,
        });
      });
      const [tp] = await ctx.db
        .select({ squadId: tournamentPlayers.squadId })
        .from(tournamentPlayers)
        .where(eq(tournamentPlayers.id, input.tournamentPlayerId))
        .limit(1);
      if (tp) {
        wsManager.broadcast(tp.squadId, 'standings_update', { squadId: tp.squadId });
      }
      return result;
    }),

  batchEnterScores: procedure
    .use(requireOrgAccess)
    .use(requireOrgRole(['owner', 'admin', 'scorer']))
    .input(
      z.object({
        scores: z.array(ScoreEntrySchema).min(1).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertTournamentPlayersInOrganization(
        ctx.db,
        input.scores.map((score) => score.tournamentPlayerId),
        ctx.orgId,
      );
      if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
      }

      const playerIds = [...new Set(input.scores.map((score) => score.tournamentPlayerId))].sort();
      const results = await ctx.db.transaction(async (tx) => {
        const lockedPlayers = await tx
          .select({ id: tournamentPlayers.id })
          .from(tournamentPlayers)
          .where(inArray(tournamentPlayers.id, playerIds))
          .orderBy(tournamentPlayers.id)
          .for('update');
        if (lockedPlayers.length !== playerIds.length) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tournament player not found' });
        }

        const savedScores = [];
        for (const score of input.scores) {
          savedScores.push(
            await enterScoreService(tx, score, {
              actorProfileId: ctx.userId,
              organizationId: ctx.orgId,
            }),
          );
        }
        return savedScores;
      });

      const squadIds = new Set<string>();
      const tps = await ctx.db
        .select({ squadId: tournamentPlayers.squadId })
        .from(tournamentPlayers)
        .where(inArray(tournamentPlayers.id, playerIds));
      for (const tp of tps) {
        squadIds.add(tp.squadId);
      }
      for (const squadId of squadIds) {
        wsManager.broadcast(squadId, 'standings_update', { squadId });
      }
      return results;
    }),

  getScoreSheet: procedure
    .use(requireOrgAccess)
    .use(requireOrgRole(['owner', 'admin', 'scorer']))
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      await assertSquadInOrganization(ctx.db, input, ctx.orgId);
      return getScoreSheet(ctx.db, input);
    }),
});
