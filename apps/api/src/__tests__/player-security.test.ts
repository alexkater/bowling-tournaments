import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { initTRPC } from '@trpc/server'
import superjson from 'superjson'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@bowling/db'
import { appRouter } from '../routers'

const queryClient = postgres(
  process.env.DATABASE_URL ?? 'postgres://bowling:***@localhost:5432/bowling',
)
const db = drizzle(queryClient, { schema })

const t = initTRPC
  .context<{ db: typeof db; userId: string | null; orgId: string | null }>()
  .create({ transformer: superjson })
const createCaller = t.createCallerFactory(appRouter)

const caller = (userId: string | null = null, orgId: string | null = null) =>
  createCaller({ db, userId, orgId })

async function resetDatabase() {
  await db.execute(sql`
    TRUNCATE TABLE
      profiles,
      organizations,
      organization_members,
      tournaments,
      stages,
      squads,
      tournament_players
    RESTART IDENTITY CASCADE
  `)
}

async function seedProfile(id: string, role: 'player' | 'organizer' = 'player') {
  const [profile] = await db
    .insert(schema.profiles)
    .values({
      id,
      email: `${id}@example.com`,
      firstName: id,
      lastName: 'Bowler',
      role,
    })
    .returning()

  if (!profile) throw new Error('Failed to seed profile')
  return profile
}

async function seedRegistration(profileId: string, suffix: string) {
  const [organization] = await db
    .insert(schema.organizations)
    .values({ name: `Organization ${suffix}`, slug: `org-${suffix}` })
    .returning()
  if (!organization) throw new Error('Failed to seed organization')

  const [tournament] = await db
    .insert(schema.tournaments)
    .values({
      organizationId: organization.id,
      name: `Tournament ${suffix}`,
      status: 'published',
      startDate: new Date('2026-08-10T00:00:00Z'),
      endDate: new Date('2026-08-11T00:00:00Z'),
    })
    .returning()
  if (!tournament) throw new Error('Failed to seed tournament')

  const [stage] = await db
    .insert(schema.stages)
    .values({
      tournamentId: tournament.id,
      name: 'Qualifying',
      format: {
        type: 'total_pins',
        gamesPerPlayer: 3,
        eventType: 'singles',
        scoring: { type: 'scratch', noTap: false },
      },
      advancement: { type: 'final' },
      sortOrder: 1,
    })
    .returning()
  if (!stage) throw new Error('Failed to seed stage')

  const [squad] = await db
    .insert(schema.squads)
    .values({
      stageId: stage.id,
      name: 'Squad A',
      date: new Date('2026-08-10T00:00:00Z'),
      startTime: '09:00',
    })
    .returning()
  if (!squad) throw new Error('Failed to seed squad')

  await db.insert(schema.tournamentPlayers).values({
    tournamentId: tournament.id,
    profileId,
    squadId: squad.id,
  })

  return tournament
}

describe('player privacy and self-service boundaries', () => {
  beforeEach(resetDatabase)

  afterAll(async () => {
    await resetDatabase()
    await queryClient.end()
  })

  it('rejects anonymous profile search and tournament history reads', async () => {
    const publicCaller = caller()

    await expect(publicCaller.player.search('bo')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    await expect(publicCaller.player.getTournaments()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    await expect(publicCaller.player.getHistory()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it('returns only the authenticated player tournament registrations', async () => {
    const playerA = await seedProfile('player-a')
    const playerB = await seedProfile('player-b')
    const tournamentA = await seedRegistration(playerA.id, 'a')
    await seedRegistration(playerB.id, 'b')

    const registrations = await caller(playerA.id).player.getTournaments()

    expect(registrations).toHaveLength(1)
    expect(registrations[0]?.tournamentId).toBe(tournamentA.id)
  })

  it('updates only the authenticated profile', async () => {
    const playerA = await seedProfile('player-a')
    const playerB = await seedProfile('player-b')

    const updated = await caller(playerA.id).player.updateMe({
      firstName: 'Updated',
      average: 210,
    })

    expect(updated.firstName).toBe('Updated')
    expect(updated.average).toBe(210)

    const [unchanged] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.id, playerB.id))

    expect(unchanged?.firstName).toBe('player-b')
    expect(unchanged?.average).toBeNull()
  })

  it('allows profile search only for an authorized organization operator', async () => {
    const owner = await seedProfile('owner', 'organizer')
    const player = await seedProfile('search-target')
    const [organization] = await db
      .insert(schema.organizations)
      .values({ name: 'Authorized Org', slug: 'authorized-org' })
      .returning()
    if (!organization) throw new Error('Failed to seed organization')

    await db.insert(schema.organizationMembers).values({
      organizationId: organization.id,
      profileId: owner.id,
      role: 'owner',
    })

    const result = await caller(owner.id, organization.id).player.search('search-target')

    expect(result.map((profile) => profile.id)).toContain(player.id)
  })
})
