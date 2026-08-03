import { and, eq, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { TRPCError } from '@trpc/server';
import {
  bracketMatches,
  bracketPools,
  bracketRounds,
  sidepots,
  squads,
  stages,
  tournamentPlayers,
  tournaments,
} from '@bowling/db';
import type * as schema from '@bowling/db';

type DB = PostgresJsDatabase<typeof schema>;

function notFound(): never {
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Tournament resource not found' });
}

export async function assertTournamentInOrganization(
  db: DB,
  tournamentId: string,
  organizationId: string,
): Promise<void> {
  const [owned] = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(and(eq(tournaments.id, tournamentId), eq(tournaments.organizationId, organizationId)))
    .limit(1);

  if (!owned) notFound();
}

export async function assertStageInOrganization(
  db: DB,
  stageId: string,
  organizationId: string,
): Promise<void> {
  const [owned] = await db
    .select({ id: stages.id })
    .from(stages)
    .innerJoin(tournaments, eq(stages.tournamentId, tournaments.id))
    .where(and(eq(stages.id, stageId), eq(tournaments.organizationId, organizationId)))
    .limit(1);

  if (!owned) notFound();
}

export async function assertSquadInOrganization(
  db: DB,
  squadId: string,
  organizationId: string,
): Promise<void> {
  const [owned] = await db
    .select({ id: squads.id })
    .from(squads)
    .innerJoin(stages, eq(squads.stageId, stages.id))
    .innerJoin(tournaments, eq(stages.tournamentId, tournaments.id))
    .where(and(eq(squads.id, squadId), eq(tournaments.organizationId, organizationId)))
    .limit(1);

  if (!owned) notFound();
}

export async function assertTournamentPlayersInOrganization(
  db: DB,
  tournamentPlayerIds: string[],
  organizationId: string,
): Promise<void> {
  const uniqueIds = [...new Set(tournamentPlayerIds)];
  const owned = await db
    .select({ id: tournamentPlayers.id })
    .from(tournamentPlayers)
    .innerJoin(tournaments, eq(tournamentPlayers.tournamentId, tournaments.id))
    .where(
      and(inArray(tournamentPlayers.id, uniqueIds), eq(tournaments.organizationId, organizationId)),
    );

  if (owned.length !== uniqueIds.length) notFound();
}

export async function assertBracketPoolInOrganization(
  db: DB,
  poolId: string,
  organizationId: string,
): Promise<void> {
  const [owned] = await db
    .select({ id: bracketPools.id })
    .from(bracketPools)
    .innerJoin(tournaments, eq(bracketPools.tournamentId, tournaments.id))
    .where(and(eq(bracketPools.id, poolId), eq(tournaments.organizationId, organizationId)))
    .limit(1);

  if (!owned) notFound();
}

export async function assertBracketMatchInOrganization(
  db: DB,
  matchId: string,
  organizationId: string,
): Promise<void> {
  const [owned] = await db
    .select({ id: bracketMatches.id })
    .from(bracketMatches)
    .innerJoin(bracketRounds, eq(bracketMatches.roundId, bracketRounds.id))
    .innerJoin(bracketPools, eq(bracketRounds.bracketPoolId, bracketPools.id))
    .innerJoin(tournaments, eq(bracketPools.tournamentId, tournaments.id))
    .where(and(eq(bracketMatches.id, matchId), eq(tournaments.organizationId, organizationId)))
    .limit(1);

  if (!owned) notFound();
}

export async function assertSidepotInOrganization(
  db: DB,
  sidepotId: string,
  organizationId: string,
): Promise<void> {
  const [owned] = await db
    .select({ id: sidepots.id })
    .from(sidepots)
    .innerJoin(tournaments, eq(sidepots.tournamentId, tournaments.id))
    .where(and(eq(sidepots.id, sidepotId), eq(tournaments.organizationId, organizationId)))
    .limit(1);

  if (!owned) notFound();
}
