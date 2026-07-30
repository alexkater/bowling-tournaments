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

// ─── tRPC test caller ─────────────────────────────────────────────

const t = initTRPC
  .context<{ db: typeof db; userId: string | null; orgId: string | null }>()
  .create({ transformer: superjson })

const createCaller = t.createCallerFactory(appRouter)

function caller(orgId?: string) {
  return createCaller({ db, userId: 'test-user', orgId: orgId ?? null })
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
      email: 'squad-organizer@example.com',
      role: 'organizer',
    })
    .onConflictDoNothing()

  const [org] = await db
    .insert(allSchema.organizations)
    .values({ name: 'Squad Test Org', slug: `squad-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })
    .returning()

  if (!org) throw new Error('Failed to seed squad test organization')

  await db.insert(allSchema.organizationMembers).values({
    organizationId: org.id,
    profileId: 'test-user',
    role: 'owner',
  })

  return org
}

async function seedTournament(orgId: string) {
  const c = caller(orgId)
  const { id } = await c.tournament.create({
    name: 'Squad Test Tournament',
    description: null,
    centerId: dummyCenterId,
    category: 'open',
    maxPlayers: null,
    allowWaitlist: true,
    startDate: new Date('2026-05-01').toISOString(),
    endDate: new Date('2026-05-03').toISOString(),
    registrationDeadline: null,
    stages: [
      {
        name: 'Qualifying',
        order: 0,
        format: {
          type: 'total_pins' as const,
          gamesPerPlayer: 3,
          eventType: 'singles' as const,
          scoring: {
            type: 'handicap' as const,
            handicapBase: 220,
            handicapPercentage: 80,
            handicapMax: null,
            noTap: false,
          },
        },
        advancement: { type: 'final' as const },
        squadConfig: null,
      },
    ],
  })
  return id
}

async function seedStage(tournamentId: string) {
  // Read the stage the tournament create just inserted
  const [stage] = await db
    .select()
    .from(allSchema.stages)
    .where(eq(allSchema.stages.tournamentId, tournamentId))
    .limit(1)
  if (!stage) throw new Error('Stage not found after tournament creation')
  return stage
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
      email: `${firstName}.${lastName}@test.com`,
      average,
      handicap: average != null ? Math.round((220 - average) * 0.8) : null,
    })
    .returning()
  return profile!
}

async function seedTournamentPlayer(
  tournamentId: string,
  squadId: string,
  profileId: string,
): Promise<typeof allSchema.tournamentPlayers.$inferSelect> {
  const [tp] = await db
    .insert(allSchema.tournamentPlayers)
    .values({
      tournamentId,
      squadId,
      profileId,
    })
    .returning()
  return tp!
}

// ─── Cleanup ──────────────────────────────────────────────────────

beforeEach(async () => {
  await queryClient`TRUNCATE organizations CASCADE`
})

// ─── Tests ─────────────────────────────────────────────────────────

describe('squad router', () => {
  it('creates a squad → returns the squad object', async () => {
    const org = await seedOrg()
    const tournamentId = await seedTournament(org.id)
    const stage = await seedStage(tournamentId)
    const c = caller(org.id)

    const squad = await c.squad.create({
      stageId: stage.id,
      name: 'Squad A',
      date: new Date('2026-05-01T09:00:00Z').toISOString(),
      startTime: '09:00',
      laneStart: 1,
      laneEnd: 8,
      maxPlayers: 24,
      sortOrder: 0,
    })

    expect(squad).toHaveProperty('id')
    expect(squad.name).toBe('Squad A')
    expect(squad.laneStart).toBe(1)
    expect(squad.laneEnd).toBe(8)
  })

  it('lists squads for a tournament', async () => {
    const org = await seedOrg()
    const tournamentId = await seedTournament(org.id)
    const stage = await seedStage(tournamentId)
    const c = caller(org.id)

    await c.squad.create({
      stageId: stage.id,
      name: 'Squad A',
      date: new Date('2026-05-01T09:00:00Z').toISOString(),
      startTime: '09:00',
      sortOrder: 0,
    })
    await c.squad.create({
      stageId: stage.id,
      name: 'Squad B',
      date: new Date('2026-05-01T13:00:00Z').toISOString(),
      startTime: '13:00',
      sortOrder: 1,
    })

    const squads = await c.squad.list({ tournamentId })
    expect(squads).toHaveLength(2)
    expect(squads[0]!.name).toBe('Squad A')
    expect(squads[1]!.name).toBe('Squad B')
  })

  it('enters a score for a player → saves with handicap', async () => {
    const org = await seedOrg()
    const tournamentId = await seedTournament(org.id)
    const stage = await seedStage(tournamentId)
    const c = caller(org.id)

    // Create squad
    const squad = await c.squad.create({
      stageId: stage.id,
      name: 'Squad A',
      date: new Date('2026-05-01T09:00:00Z').toISOString(),
      startTime: '09:00',
      sortOrder: 0,
    })

    // Seed profile with average 180 → handicap = (220-180)*0.8 = 32
    const profile = await seedProfile('John', 'Doe', 180)
    const tp = await seedTournamentPlayer(tournamentId, squad.id, profile.id)

    const game = await c.squad.enterScore({
      tournamentPlayerId: tp.id,
      gameNumber: 1,
      rawScore: 200,
      pins: [10, 7, 3, 10, 10, 10, 9, 1, 10, 10, 10, 10],
    })

    expect(game).toHaveProperty('id')
    expect(game.rawScore).toBe(200)
    // handicapScore = (220-180)*0.8 = 32
    expect(game.handicapScore).toBe(32)
    expect(game.tournamentPlayerId).toBe(tp.id)
  })

  it('enters a raw score of 300 → handicap still applied', async () => {
    const org = await seedOrg()
    const tournamentId = await seedTournament(org.id)
    const stage = await seedStage(tournamentId)
    const c = caller(org.id)

    const squad = await c.squad.create({
      stageId: stage.id,
      name: 'Squad A',
      date: new Date('2026-05-01T09:00:00Z').toISOString(),
      startTime: '09:00',
      sortOrder: 0,
    })

    const profile = await seedProfile('Jane', 'Smith', 200)
    // Handicap = (220-200)*0.8 = 16
    const tp = await seedTournamentPlayer(tournamentId, squad.id, profile.id)

    const game = await c.squad.enterScore({
      tournamentPlayerId: tp.id,
      gameNumber: 1,
      rawScore: 300,
      pins: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
    })

    expect(game.rawScore).toBe(300)
    expect(game.handicapScore).toBe(16)
  })

  it('rejects a score of 301 (out of range)', async () => {
    const org = await seedOrg()
    const tournamentId = await seedTournament(org.id)
    const stage = await seedStage(tournamentId)
    const c = caller(org.id)

    const squad = await c.squad.create({
      stageId: stage.id,
      name: 'Squad A',
      date: new Date('2026-05-01T09:00:00Z').toISOString(),
      startTime: '09:00',
      sortOrder: 0,
    })

    const profile = await seedProfile('Bad', 'Score', null)
    const tp = await seedTournamentPlayer(tournamentId, squad.id, profile.id)

    const promise = c.squad.enterScore({
      tournamentPlayerId: tp.id,
      gameNumber: 1,
      rawScore: 301,
      pins: [],
    })

    await expect(promise).rejects.toThrow()
  })

  it('rejects a negative score', async () => {
    const org = await seedOrg()
    const tournamentId = await seedTournament(org.id)
    const stage = await seedStage(tournamentId)
    const c = caller(org.id)

    const squad = await c.squad.create({
      stageId: stage.id,
      name: 'Squad A',
      date: new Date('2026-05-01T09:00:00Z').toISOString(),
      startTime: '09:00',
      sortOrder: 0,
    })

    const profile = await seedProfile('Negative', 'Player', null)
    const tp = await seedTournamentPlayer(tournamentId, squad.id, profile.id)

    const promise = c.squad.enterScore({
      tournamentPlayerId: tp.id,
      gameNumber: 1,
      rawScore: -5,
      pins: [],
    })

    await expect(promise).rejects.toThrow()
  })

  it('returns the score sheet grid', async () => {
    const org = await seedOrg()
    const tournamentId = await seedTournament(org.id)
    const stage = await seedStage(tournamentId)
    const c = caller(org.id)

    const squad = await c.squad.create({
      stageId: stage.id,
      name: 'Grid Squad',
      date: new Date('2026-05-01T09:00:00Z').toISOString(),
      startTime: '09:00',
      sortOrder: 0,
    })

    const profile1 = await seedProfile('Alice', 'Adams', 150)
    const profile2 = await seedProfile('Bob', 'Baker', 200)
    const tp1 = await seedTournamentPlayer(tournamentId, squad.id, profile1.id)
    const tp2 = await seedTournamentPlayer(tournamentId, squad.id, profile2.id)

    // Enter 2 games for Alice
    await c.squad.enterScore({ tournamentPlayerId: tp1.id, gameNumber: 1, rawScore: 180, pins: [] })
    await c.squad.enterScore({ tournamentPlayerId: tp1.id, gameNumber: 2, rawScore: 190, pins: [] })

    // Enter 1 game for Bob
    await c.squad.enterScore({ tournamentPlayerId: tp2.id, gameNumber: 1, rawScore: 210, pins: [] })

    const sheet = await c.squad.getScoreSheet(squad.id)

    expect(sheet.squad.id).toBe(squad.id)
    expect(sheet.gameNumbers).toEqual([1, 2])
    expect(sheet.rows).toHaveLength(2)

    // Alice row — 2 games
    const aliceRow = sheet.rows.find((r) => r.player.id === tp1.id)
    expect(aliceRow).toBeDefined()
    expect(aliceRow!.games).toHaveLength(2)
    expect(aliceRow!.games[0]?.rawScore).toBe(180)
    expect(aliceRow!.games[1]?.rawScore).toBe(190)

    // Bob row — 1 game, second is null
    const bobRow = sheet.rows.find((r) => r.player.id === tp2.id)
    expect(bobRow).toBeDefined()
    expect(bobRow!.games[0]?.rawScore).toBe(210)
    expect(bobRow!.games[1]).toBeNull()
  })
})
