import { eq, inArray, asc } from 'drizzle-orm'
import { games, tournamentPlayers, profiles, squads, stages } from '@bowling/db'
import { calculateHandicap, totalWithHandicap, applyTiebreaker } from '@bowling/shared'
import type { StandingsEntry, TiebreakerRule } from '@bowling/shared'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '@bowling/db'

type DB = PostgresJsDatabase<typeof schema>

export interface StageConfig {
  tiebreakerRule: TiebreakerRule
  advanceCount: number | null
  isHandicap: boolean
  handicapBase: number
  handicapPercentage: number
  handicapMax: number | null
}

export async function getStageConfig(db: DB, squadId: string): Promise<StageConfig> {
  const [row] = await db
    .select()
    .from(squads)
    .innerJoin(stages, eq(squads.stageId, stages.id))
    .where(eq(squads.id, squadId))
    .limit(1)

  if (!row) {
    return {
      tiebreakerRule: 'highest_game',
      advanceCount: null,
      isHandicap: false,
      handicapBase: 220,
      handicapPercentage: 80,
      handicapMax: null,
    }
  }

  const stage = row.stages
  const format = stage.format as Record<string, unknown> | undefined
  const scoring = format?.scoring as Record<string, unknown> | undefined
  const isHandicap = scoring?.type === 'handicap'

  const advancement = stage.advancement as Record<string, unknown> | undefined
  const tiebreakerRule: TiebreakerRule =
    advancement?.type === 'cut_line' && typeof advancement.tiebreaker === 'string'
      ? (advancement.tiebreaker as TiebreakerRule)
      : 'highest_game'

  const advanceCount: number | null =
    advancement?.type === 'cut_line' && typeof advancement.advanceCount === 'number'
      ? advancement.advanceCount
      : null

  return {
    tiebreakerRule,
    advanceCount,
    isHandicap,
    handicapBase: (scoring?.handicapBase ?? 220) as number,
    handicapPercentage: (scoring?.handicapPercentage ?? 80) as number,
    handicapMax: (scoring?.handicapMax ?? null) as number | null,
  }
}

export async function computeSquadStandings(
  db: DB,
  squadId: string,
  config: StageConfig,
): Promise<StandingsEntry[]> {
  const players = await db
    .select()
    .from(tournamentPlayers)
    .where(eq(tournamentPlayers.squadId, squadId))

  if (players.length === 0) return []

  const tpIds = players.map((p: { id: string }) => p.id)

  const allGames = await db
    .select()
    .from(games)
    .where(inArray(games.tournamentPlayerId, tpIds))
    .orderBy(asc(games.gameNumber))

  const gamesByTpId = new Map<string, unknown[]>()
  for (const g of allGames) {
    const list = gamesByTpId.get(g.tournamentPlayerId) ?? []
    list.push(g)
    gamesByTpId.set(g.tournamentPlayerId, list)
  }

  const pIds = [...new Set(players.map((p: { profileId: string }) => p.profileId))] as string[]
  const profileRows =
    pIds.length > 0
      ? await db
          .select()
          .from(profiles)
          .where(inArray(profiles.id, pIds))
      : []
  const profileById = new Map<string, unknown>(profileRows.map((p: { id: string }) => [p.id, p]))

  const entries: StandingsEntry[] = []
  for (const tp of players) {
    const profile = profileById.get(tp.profileId) as { firstName?: string; lastName?: string; average?: number } | undefined
    const playerGames = (gamesByTpId.get(tp.id) ?? []) as Array<{ id: string; tournamentPlayerId: string; gameNumber: number; rawScore: number; handicapScore: number | null; pins: number[] }>

    let handicapPerGame = 0
    if (config.isHandicap && profile && profile.average != null) {
      handicapPerGame = calculateHandicap(profile.average, {
        base: config.handicapBase,
        percentage: config.handicapPercentage,
        max: config.handicapMax,
      })
    }

    const gameEntries = playerGames.map((g) => ({
      id: g.id,
      tournamentPlayerId: g.tournamentPlayerId,
      gameNumber: g.gameNumber,
      frames: [] as never[],
      rawScore: g.rawScore,
      handicapScore: g.handicapScore,
      pins: g.pins,
    }))

    const totalRaw = playerGames.reduce((sum, g) => sum + g.rawScore, 0)
    const totalHandicap = config.isHandicap
      ? totalWithHandicap(totalRaw, handicapPerGame, playerGames.length)
      : totalRaw

    entries.push({
      rank: 0,
      playerId: tp.profileId,
      playerName: profile ? `${profile.firstName} ${profile.lastName}` : 'Unknown',
      totalRaw,
      totalHandicap,
      games: gameEntries,
      behind: 0,
      isCut: false,
    })
  }

  return entries
}

export function rankAndCut(
  entries: StandingsEntry[],
  rule: TiebreakerRule,
  advanceCount: number | null,
): StandingsEntry[] {
  const sorted = applyTiebreaker(entries, rule)

  if (advanceCount !== null) {
    for (const entry of sorted) {
      if (entry.rank > advanceCount) {
        entry.isCut = true
      }
    }
  }

  return sorted
}
