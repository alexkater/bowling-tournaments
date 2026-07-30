import { eq, and, inArray, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '@bowling/db'
import { sidepots, sidepotEntries, tournamentPlayers, games, profiles, tournaments } from '@bowling/db'
import { TRPCError } from '@trpc/server'

type DB = PostgresJsDatabase<typeof schema>

export interface SidepotConfig {
  handicap: boolean
  maxEntries: number | null
  payoutRatio: number
  gamesIncluded: number[]
  gender: 'all' | 'male' | 'female' | null
}

export async function getSidepotOrThrow(db: DB, sidepotId: string) {
  const [sidepot] = await db
    .select()
    .from(sidepots)
    .where(eq(sidepots.id, sidepotId))
    .limit(1)
  if (!sidepot) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sidepot not found' })
  return sidepot
}

export async function getEntriesForSidepot(db: DB, sidepotId: string) {
  return db
    .select()
    .from(sidepotEntries)
    .where(eq(sidepotEntries.sidepotId, sidepotId))
}

export async function buildPlayerScores(db: DB, tpIds: string[]) {
  if (tpIds.length === 0) return []

  const tps = await db
    .select()
    .from(tournamentPlayers)
    .where(inArray(tournamentPlayers.id, tpIds))

  const profileIds = [...new Set(tps.map((tp) => tp.profileId))]
  const profileRows =
    profileIds.length > 0
      ? await db.select().from(profiles).where(inArray(profiles.id, profileIds))
      : []
  const profileMap = new Map(profileRows.map((p) => [p.id, p]))

  const gameRows = await db
    .select()
    .from(games)
    .where(inArray(games.tournamentPlayerId, tpIds))
    .orderBy(games.gameNumber)

  const gamesByTpId: Record<string, typeof gameRows[number][]> = {}
  for (const g of gameRows) {
    (gamesByTpId[g.tournamentPlayerId] ??= []).push(g)
  }

  return tps.map((tp) => {
    const profile = profileMap.get(tp.profileId)
    const playerGames = gamesByTpId[tp.id] ?? []
    const scores = playerGames
      .slice()
      .sort((a, b) => a.gameNumber - b.gameNumber)
      .map((g) => g.rawScore)
    return {
      playerId: tp.id,
      scores,
      average: profile?.average ?? 200,
    }
  })
}

export function computePrizes(
  entryFee: number,
  entryCount: number,
  payoutRatio: number,
  winnerCount: number,
): { prizePool: number; payout: number } {
  const prizePool = entryFee * entryCount
  const payout = winnerCount > 0 ? Math.floor((prizePool * payoutRatio) / winnerCount) : 0
  return { prizePool, payout }
}

export async function createSidepot(
  db: DB,
  input: {
    tournamentId: string
    name: string
    type: string
    entryFee: number
    config: SidepotConfig
  },
) {
  const [tournament] = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(eq(tournaments.id, input.tournamentId))
    .limit(1)
  if (!tournament) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Tournament not found' })
  }

  const [sidepot] = await db
    .insert(sidepots)
    .values({
      tournamentId: input.tournamentId,
      name: input.name,
      type: input.type,
      entryFee: input.entryFee,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: input.config as any,
    })
    .returning()

  if (!sidepot) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create sidepot' })
  }

  return sidepot
}

export async function joinSidepot(
  db: DB,
  params: { sidepotId: string; tournamentPlayerId: string },
) {
  const sidepot = await getSidepotOrThrow(db, params.sidepotId)

  const [tp] = await db
    .select()
    .from(tournamentPlayers)
    .where(eq(tournamentPlayers.id, params.tournamentPlayerId))
    .limit(1)
  if (!tp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tournament player not found' })

  if (tp.tournamentId !== sidepot.tournamentId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Player is not registered in this tournament' })
  }

  const config = sidepot.config as SidepotConfig

  const [existing] = await db
    .select({ id: sidepotEntries.id })
    .from(sidepotEntries)
    .where(
      and(
        eq(sidepotEntries.sidepotId, params.sidepotId),
        eq(sidepotEntries.tournamentPlayerId, params.tournamentPlayerId),
      ),
    )
    .limit(1)
  if (existing) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Player already entered in this sidepot' })
  }

  if (config.maxEntries !== null) {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sidepotEntries)
      .where(eq(sidepotEntries.sidepotId, params.sidepotId))
    const entryCount = result?.count ?? 0
    if (entryCount >= config.maxEntries) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sidepot has reached maximum entries' })
    }
  }

  const [entry] = await db
    .insert(sidepotEntries)
    .values({
      sidepotId: params.sidepotId,
      tournamentPlayerId: params.tournamentPlayerId,
      paid: false,
    })
    .returning()

  if (!entry) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to join sidepot' })
  }

  return entry
}
