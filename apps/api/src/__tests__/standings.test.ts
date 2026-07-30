import { describe, it, expect, beforeEach } from 'vitest'
import { initTRPC } from '@trpc/server'
import superjson from 'superjson'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as allSchema from '@bowling/db'
import { appRouter } from '../routers'
import { TRPCError } from '@trpc/server'

// ─── Test DB connection ────────────────────────────────────────────

const queryClient = postgres(
  process.env.DATABASE_URL ?? 'postgres://bowling:bowling@localhost:5432/bowling',
)
const db = drizzle(queryClient, { schema: allSchema })

// ─── tRPC test caller (standings uses requireAuth → userId needed) ──

const t = initTRPC
  .context<{ db: typeof db; userId: string | null; orgId: string | null }>()
  .create({ transformer: superjson })

const createCaller = t.createCallerFactory(appRouter)

function caller(overrides?: { userId?: string; orgId?: string }) {
  return createCaller({
    db,
    userId: overrides?.userId ?? 'test-user',
    orgId: overrides?.orgId ?? null,
  })
}

// ─── Helpers ───────────────────────────────────────────────────────

const dummyCenterId = '00000000-0000-0000-0000-000000000000'

async function seedOrg(): Promise<typeof allSchema.organizations.$inferSelect> {
  await db
    .insert(allSchema.profiles)
    .values({
      id: 'test-user',
      firstName: 'Test',
      lastName: 'Organizer',
      email: 'standings-organizer@example.com',
      role: 'organizer',
    })
    .onConflictDoNothing()

  const [org] = await db
    .insert(allSchema.organizations)
    .values({
      name: 'Standings Test Org',
      slug: `standings-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    })
    .returning()

  if (!org) throw new Error('Failed to seed standings test organization')

  await db.insert(allSchema.organizationMembers).values({
    organizationId: org.id,
    profileId: 'test-user',
    role: 'owner',
  })

  return org
}

async function seedTournamentWithStage(
  orgId: string,
  scoring: { type: 'scratch' | 'handicap'; handicapBase?: number; handicapPercentage?: number; handicapMax?: number | null } = { type: 'scratch' },
) {
  const c = caller({ orgId })

  const format: Record<string, unknown> = {
    type: 'total_pins',
    gamesPerPlayer: 3,
    eventType: 'singles',
    scoring: {
      type: scoring.type,
      handicapBase: scoring.handicapBase ?? 220,
      handicapPercentage: scoring.handicapPercentage ?? 80,
      handicapMax: scoring.handicapMax ?? null,
      noTap: false,
    },
  }

  const { id: tournamentId } = await c.tournament.create({
    name: 'Standings Test',
    description: null,
    centerId: dummyCenterId,
    category: 'open',
    maxPlayers: null,
    allowWaitlist: true,
    startDate: new Date('2026-04-01').toISOString(),
    endDate: new Date('2026-04-03').toISOString(),
    registrationDeadline: null,
    stages: [
      {
        name: 'Qualifying',
        order: 0,
        format,
        advancement: { type: 'final' },
        squadConfig: null,
      },
    ],
  })

  const [stage] = await db
    .select()
    .from(allSchema.stages)
    .where(eq(allSchema.stages.tournamentId, tournamentId))
    .limit(1)

  return { tournamentId, stage: stage! }
}

async function seedProfile(
  firstName: string,
  lastName: string,
  average: number | null,
): Promise<typeof allSchema.profiles.$inferSelect> {
  const [profile] = await db
    .insert(allSchema.profiles)
    .values({
      id: crypto.randomUUID(),
      firstName,
      lastName,
      email: `${firstName}.${lastName}@standings-test.com`,
      average,
      handicap: average != null ? Math.round((220 - average) * 0.8) : null,
    })
    .returning()
  return profile!
}

async function seedSquad(orgId: string, stageId: string) {
  const c = caller({ orgId })
  return c.squad.create({
    stageId,
    name: 'Standings Squad',
    date: new Date('2026-04-01T09:00:00Z').toISOString(),
    startTime: '09:00',
    sortOrder: 0,
  })
}

async function seedTournamentPlayer(
  tournamentId: string,
  squadId: string,
  profileId: string,
): Promise<typeof allSchema.tournamentPlayers.$inferSelect> {
  const [tp] = await db
    .insert(allSchema.tournamentPlayers)
    .values({ tournamentId, squadId, profileId })
    .returning()
  return tp!
}

async function enterScore(
  orgId: string,
  tournamentPlayerId: string,
  gameNumber: number,
  rawScore: number,
) {
  const c = caller({ orgId })
  return c.squad.enterScore({ tournamentPlayerId, gameNumber, rawScore, pins: [] })
}

// ─── Cleanup ──────────────────────────────────────────────────────

beforeEach(async () => {
  await queryClient`TRUNCATE organizations CASCADE`
})

// ─── Tests ─────────────────────────────────────────────────────────

describe('standings router', () => {
  it('returns empty standings for a squad with no players', async () => {
    const org = await seedOrg()
    const { stage } = await seedTournamentWithStage(org.id)
    const squad = await seedSquad(org.id, stage.id)
    const c = caller({ orgId: org.id })

    const standings = await c.standings.getBySquad(squad.id)
    expect(standings).toEqual([])
  })

  it('returns standings ordered by total raw descending (scratch)', async () => {
    const org = await seedOrg()
    const { tournamentId, stage } = await seedTournamentWithStage(org.id, { type: 'scratch' })
    const squad = await seedSquad(org.id, stage.id)
    const c = caller({ orgId: org.id })

    // Player A: 180 + 200 + 160 = 540
    const profileA = await seedProfile('Alice', 'Adams', null)
    const tpA = await seedTournamentPlayer(tournamentId, squad.id, profileA.id)
    await enterScore(org.id, tpA.id, 1, 180)
    await enterScore(org.id, tpA.id, 2, 200)
    await enterScore(org.id, tpA.id, 3, 160)

    // Player B: 210 + 190 + 220 = 620
    const profileB = await seedProfile('Bob', 'Baker', null)
    const tpB = await seedTournamentPlayer(tournamentId, squad.id, profileB.id)
    await enterScore(org.id, tpB.id, 1, 210)
    await enterScore(org.id, tpB.id, 2, 190)
    await enterScore(org.id, tpB.id, 3, 220)

    const standings = await c.standings.getBySquad(squad.id)

    expect(standings).toHaveLength(2)

    // Bob ranks first (620 > 540)
    expect(standings[0]!.playerName).toBe('Bob Baker')
    expect(standings[0]!.totalRaw).toBe(620)
    expect(standings[0]!.rank).toBe(1)
    expect(standings[0]!.behind).toBe(0)

    // Alice ranks second
    expect(standings[1]!.playerName).toBe('Alice Adams')
    expect(standings[1]!.totalRaw).toBe(540)
    expect(standings[1]!.rank).toBe(2)
    expect(standings[1]!.behind).toBe(80)
  })

  it('applies handicap correctly in handicap-scored tournaments', async () => {
    const org = await seedOrg()
    const { tournamentId, stage } = await seedTournamentWithStage(org.id, {
      type: 'handicap',
      handicapBase: 220,
      handicapPercentage: 80,
      handicapMax: null,
    })
    const squad = await seedSquad(org.id, stage.id)
    const c = caller({ orgId: org.id })

    // Player A: avg=180 → handicap = (220-180)*0.8 = 32/game
    // Game scores: 180, 190, 170
    // Raw total = 540, handicap total = 540 + 32*3 = 636
    const profileA = await seedProfile('Charlie', 'Clark', 180)
    const tpA = await seedTournamentPlayer(tournamentId, squad.id, profileA.id)
    await enterScore(org.id, tpA.id, 1, 180)
    await enterScore(org.id, tpA.id, 2, 190)
    await enterScore(org.id, tpA.id, 3, 170)

    // Player B: avg=200 → handicap = (220-200)*0.8 = 16/game
    // Game scores: 200, 195, 205
    // Raw total = 600, handicap total = 600 + 16*3 = 648
    const profileB = await seedProfile('Diana', 'Diaz', 200)
    const tpB = await seedTournamentPlayer(tournamentId, squad.id, profileB.id)
    await enterScore(org.id, tpB.id, 1, 200)
    await enterScore(org.id, tpB.id, 2, 195)
    await enterScore(org.id, tpB.id, 3, 205)

    const standings = await c.standings.getBySquad(squad.id)

    expect(standings).toHaveLength(2)

    // Diana has higher totalHandicap (648 > 636) → ranks first
    expect(standings[0]!.playerName).toBe('Diana Diaz')
    expect(standings[0]!.totalRaw).toBe(600)
    expect(standings[0]!.totalHandicap).toBe(648)
    expect(standings[0]!.rank).toBe(1)

    expect(standings[1]!.playerName).toBe('Charlie Clark')
    expect(standings[1]!.totalRaw).toBe(540)
    expect(standings[1]!.totalHandicap).toBe(636)
    expect(standings[1]!.rank).toBe(2)

    // Verify handicap pins are in the game entries
    for (const entry of standings) {
      for (const game of entry.games) {
        if (entry.playerId === profileA.id) {
          expect(game.handicapScore).toBe(32)
        } else {
          expect(game.handicapScore).toBe(16)
        }
      }
    }
  })

  it('applies tiebreaker (highest_game) when totals are identical', async () => {
    const org = await seedOrg()
    const { tournamentId, stage } = await seedTournamentWithStage(org.id, { type: 'scratch' })
    const squad = await seedSquad(org.id, stage.id)
    const c = caller({ orgId: org.id })

    // Both players have totalRaw = 600
    // Player A: 200, 200, 200 → best game = 200
    const profileA = await seedProfile('Eve', 'Evans', null)
    const tpA = await seedTournamentPlayer(tournamentId, squad.id, profileA.id)
    await enterScore(org.id, tpA.id, 1, 200)
    await enterScore(org.id, tpA.id, 2, 200)
    await enterScore(org.id, tpA.id, 3, 200)

    // Player B: 220, 180, 200 → best game = 220
    const profileB = await seedProfile('Frank', 'Fox', null)
    const tpB = await seedTournamentPlayer(tournamentId, squad.id, profileB.id)
    await enterScore(org.id, tpB.id, 1, 220)
    await enterScore(org.id, tpB.id, 2, 180)
    await enterScore(org.id, tpB.id, 3, 200)

    const standings = await c.standings.getBySquad(squad.id)

    expect(standings).toHaveLength(2)

    // Both have same total raw
    expect(standings[0]!.totalRaw).toBe(600)
    expect(standings[1]!.totalRaw).toBe(600)

    // Frank (best=220) beats Eve (best=200) on tiebreaker
    expect(standings[0]!.playerName).toBe('Frank Fox')
    expect(standings[1]!.playerName).toBe('Eve Evans')
  })

  it('returns public standings without authentication', async () => {
    const org = await seedOrg()
    const { tournamentId, stage } = await seedTournamentWithStage(org.id, { type: 'scratch' })
    const squad = await seedSquad(org.id, stage.id)
    const c = caller({ orgId: org.id })

    const profile = await seedProfile('Public', 'Player', null)
    const tp = await seedTournamentPlayer(tournamentId, squad.id, profile.id)
    await enterScore(org.id, tp.id, 1, 150)
    await enterScore(org.id, tp.id, 2, 160)
    await enterScore(org.id, tp.id, 3, 170)

    // getPublic does NOT use requireAuth — caller with no userId works
    const publicCaller = caller({ orgId: org.id })
    const standings = await publicCaller.standings.getPublic(squad.id)

    expect(standings).toHaveLength(1)
    expect(standings[0]!.playerName).toBe('Public Player')
    expect(standings[0]!.totalRaw).toBe(480)
  })
})
