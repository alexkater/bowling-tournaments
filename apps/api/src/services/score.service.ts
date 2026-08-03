import { eq, and, asc, inArray } from 'drizzle-orm';
import { tournamentPlayers, games, scoreAuditLogs, stages, squads, profiles } from '@bowling/db';
import type { ScoreAuditValue } from '@bowling/db';
import { calculateHandicap } from '@bowling/shared';
import { TRPCError } from '@trpc/server';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '@bowling/db';

type DB = Pick<PostgresJsDatabase<typeof schema>, 'select' | 'insert' | 'update'>;

type ScoreAuditContext = {
  actorProfileId: string;
  organizationId: string;
};

export async function resolveHandicap(db: DB, tournamentPlayerId: string): Promise<number | null> {
  const [tp] = await db
    .select()
    .from(tournamentPlayers)
    .where(eq(tournamentPlayers.id, tournamentPlayerId))
    .limit(1);
  if (!tp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tournament player not found' });

  const [profile] = await db
    .select({ average: profiles.average })
    .from(profiles)
    .where(eq(profiles.id, tp.profileId))
    .limit(1);
  if (!profile) throw new TRPCError({ code: 'NOT_FOUND', message: 'Player profile not found' });

  const [row] = await db
    .select({ stage: stages })
    .from(squads)
    .innerJoin(stages, eq(squads.stageId, stages.id))
    .where(eq(squads.id, tp.squadId))
    .limit(1);
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Squad or stage not found' });

  const format = row.stage.format as Record<string, unknown> | undefined;
  const scoring = format?.scoring as Record<string, unknown> | undefined;

  if (!scoring || scoring.type !== 'handicap') return null;

  return calculateHandicap(profile.average ?? 0, {
    base: (scoring.handicapBase ?? 220) as number,
    percentage: (scoring.handicapPercentage ?? 80) as number,
    max: (scoring.handicapMax ?? null) as number | null,
  });
}

type Game = typeof games.$inferSelect;

function gameAuditValue(game: Game): ScoreAuditValue {
  return {
    gameNumber: game.gameNumber,
    rawScore: game.rawScore,
    handicapScore: game.handicapScore,
    pins: game.pins,
  };
}

export async function upsertGame(
  db: DB,
  data: {
    tournamentPlayerId: string;
    gameNumber: number;
    rawScore: number;
    handicapScore: number | null;
    pins: number[];
  },
): Promise<{ game: Game; previous: Game | null }> {
  const [existing] = await db
    .select()
    .from(games)
    .where(
      and(
        eq(games.tournamentPlayerId, data.tournamentPlayerId),
        eq(games.gameNumber, data.gameNumber),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(games)
      .set({
        rawScore: data.rawScore,
        handicapScore: data.handicapScore,
        pins: data.pins,
      })
      .where(eq(games.id, existing.id))
      .returning();
    if (!updated) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update game' });
    }
    return { game: updated, previous: existing };
  }

  const [game] = await db
    .insert(games)
    .values({
      tournamentPlayerId: data.tournamentPlayerId,
      gameNumber: data.gameNumber,
      rawScore: data.rawScore,
      handicapScore: data.handicapScore,
      pins: data.pins,
    })
    .returning();
  if (!game) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create game' });
  }
  return { game, previous: null };
}

export async function enterScore(
  db: DB,
  input: { tournamentPlayerId: string; gameNumber: number; rawScore: number; pins: number[] },
  audit: ScoreAuditContext,
) {
  const [tp] = await db
    .select({ tournamentId: tournamentPlayers.tournamentId })
    .from(tournamentPlayers)
    .where(eq(tournamentPlayers.id, input.tournamentPlayerId))
    .limit(1);
  if (!tp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tournament player not found' });

  const handicapScore = await resolveHandicap(db, input.tournamentPlayerId);
  const { game, previous } = await upsertGame(db, {
    tournamentPlayerId: input.tournamentPlayerId,
    gameNumber: input.gameNumber,
    rawScore: input.rawScore,
    handicapScore,
    pins: input.pins,
  });

  await db.insert(scoreAuditLogs).values({
    organizationId: audit.organizationId,
    tournamentId: tp.tournamentId,
    actorProfileId: audit.actorProfileId,
    resourceType: 'game',
    resourceId: game.id,
    operation: previous ? 'updated' : 'created',
    previousValue: previous ? gameAuditValue(previous) : null,
    newValue: gameAuditValue(game),
  });

  return game;
}

export async function getScoreSheet(db: DB, squadId: string) {
  const [squad] = await db.select().from(squads).where(eq(squads.id, squadId)).limit(1);

  if (!squad) throw new TRPCError({ code: 'NOT_FOUND', message: 'Squad not found' });

  const players = await db
    .select({
      id: tournamentPlayers.id,
      profileId: tournamentPlayers.profileId,
      squadId: tournamentPlayers.squadId,
      lane: tournamentPlayers.lane,
      checkedIn: tournamentPlayers.checkedIn,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(tournamentPlayers)
    .leftJoin(profiles, eq(tournamentPlayers.profileId, profiles.id))
    .where(eq(tournamentPlayers.squadId, squadId));

  const playerIds = players.map((p) => p.id);

  const allGames =
    playerIds.length > 0
      ? await db
          .select()
          .from(games)
          .where(inArray(games.tournamentPlayerId, playerIds))
          .orderBy(asc(games.gameNumber))
      : [];

  const maxGameNumber = allGames.reduce((max, g) => Math.max(max, g.gameNumber), 0);
  const gameNumbers =
    maxGameNumber > 0 ? Array.from({ length: maxGameNumber }, (_, i) => i + 1) : [];

  const gamesByPlayer = new Map<string, (typeof allGames)[number]>();
  for (const game of allGames) {
    gamesByPlayer.set(`${game.tournamentPlayerId}:${game.gameNumber}`, game);
  }

  const rows = players.map((player) => {
    const gameScores = gameNumbers.map((gn) => {
      const g = gamesByPlayer.get(`${player.id}:${gn}`);
      return g
        ? { id: g.id, rawScore: g.rawScore, handicapScore: g.handicapScore, pins: g.pins }
        : null;
    });

    return {
      player: {
        id: player.id,
        profileId: player.profileId,
        lane: player.lane,
        checkedIn: player.checkedIn,
        firstName: player.firstName,
        lastName: player.lastName,
      },
      games: gameScores,
    };
  });

  return { squad, gameNumbers, rows };
}
