import { beforeEach, describe, expect, it } from 'vitest'
import { initTRPC } from '@trpc/server'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import superjson from 'superjson'
import * as schema from '@bowling/db'
import { appRouter } from '../routers'

const queryClient = postgres(
  process.env.DATABASE_URL ?? 'postgres://bowling:bowling@localhost:5432/bowling',
)
const db = drizzle(queryClient, { schema })

const t = initTRPC
  .context<{ db: typeof db; userId: string | null; orgId: string | null }>()
  .create({ transformer: superjson })
const createCaller = t.createCallerFactory(appRouter)

type CallerContext = {
  readonly userId: string | null
  readonly orgId: string | null
}

type MembershipRole = 'owner' | 'admin' | 'member'

function caller(context: CallerContext) {
  return createCaller({ db, ...context })
}

async function seedProfile(id: string, role: 'organizer' | 'player' = 'organizer') {
  await db
    .insert(schema.profiles)
    .values({
      id,
      firstName: role === 'player' ? 'Player' : 'Test',
      lastName: id,
      email: `${id}@example.com`,
      role,
    })
    .onConflictDoNothing()

  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.id, id))
    .limit(1)

  if (!profile) throw new Error('Failed to seed profile')
  return profile
}

async function seedOrganization(profileId: string, role: MembershipRole = 'owner') {
  await seedProfile(profileId)
  const [organization] = await db
    .insert(schema.organizations)
    .values({ name: `Organization ${profileId}`, slug: `organization-${crypto.randomUUID()}` })
    .returning()

  if (!organization) throw new Error('Failed to seed organization')

  await db.insert(schema.organizationMembers).values({
    organizationId: organization.id,
    profileId,
    role,
  })

  return organization
}

async function seedTournament(organizationId: string, name: string) {
  const [tournament] = await db
    .insert(schema.tournaments)
    .values({
      organizationId,
      name,
      startDate: new Date('2026-08-01T00:00:00Z'),
      endDate: new Date('2026-08-03T00:00:00Z'),
    })
    .returning()

  if (!tournament) throw new Error('Failed to seed tournament')

  const [stage] = await db
    .insert(schema.stages)
    .values({
      tournamentId: tournament.id,
      name: 'Final',
      sortOrder: 0,
      format: { type: 'total_pins', gamesPerPlayer: 3 },
      advancement: { type: 'final' },
    })
    .returning()

  if (!stage) throw new Error('Failed to seed stage')
  return { tournament, stage }
}

async function seedSquad(stageId: string) {
  const [squad] = await db
    .insert(schema.squads)
    .values({
      stageId,
      name: 'Squad A',
      date: new Date('2026-08-01T09:00:00Z'),
      startTime: '09:00',
    })
    .returning()

  if (!squad) throw new Error('Failed to seed squad')
  return squad
}

beforeEach(async () => {
  await queryClient`TRUNCATE organizations CASCADE`
})

describe('tournament tenant isolation', () => {
  it('keeps public list and byId available without authentication', async () => {
    const organizationA = await seedOrganization('owner-a')
    const organizationB = await seedOrganization('owner-b')
    const { tournament: tournamentA } = await seedTournament(organizationA.id, 'Tournament A')
    const { tournament: tournamentB } = await seedTournament(organizationB.id, 'Tournament B')
    const publicCaller = caller({ userId: null, orgId: null })

    const list = await publicCaller.tournament.list({ limit: 10 })
    const detail = await publicCaller.tournament.byId(tournamentA.id)

    expect(list.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([tournamentA.id, tournamentB.id]),
    )
    expect(detail.id).toBe(tournamentA.id)
    expect(detail.stages).toHaveLength(1)
  })

  it('scopes organizer list to the derived organization membership', async () => {
    const organizationA = await seedOrganization('owner-a')
    const organizationB = await seedOrganization('owner-b')
    const { tournament: tournamentA } = await seedTournament(organizationA.id, 'Tournament A')
    await seedTournament(organizationB.id, 'Tournament B')
    const organizer = caller({ userId: 'owner-a', orgId: null })

    const result = await organizer.tournament.organizerList({ limit: 10 })

    expect(result.items.map((item) => item.id)).toEqual([tournamentA.id])
  })

  it('rejects organizer reads without authentication', async () => {
    const publicCaller = caller({ userId: null, orgId: null })

    await expect(publicCaller.tournament.organizerList({ limit: 10 })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it('rejects an unverified organization candidate', async () => {
    await seedOrganization('owner-a')
    const organizationB = await seedOrganization('owner-b')
    const organizer = caller({ userId: 'owner-a', orgId: organizationB.id })

    await expect(organizer.tournament.organizerList({ limit: 10 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('hides a foreign tournament from organizer detail', async () => {
    await seedOrganization('owner-a')
    const organizationB = await seedOrganization('owner-b')
    const { tournament } = await seedTournament(organizationB.id, 'Tournament B')
    const organizer = caller({ userId: 'owner-a', orgId: null })

    await expect(organizer.tournament.organizerById(tournament.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Tournament not found',
    })
  })

  it('returns an owned tournament from organizer detail', async () => {
    const organization = await seedOrganization('owner-a')
    const { tournament } = await seedTournament(organization.id, 'Tournament A')
    const organizer = caller({ userId: 'owner-a', orgId: null })

    const result = await organizer.tournament.organizerById(tournament.id)

    expect(result.id).toBe(tournament.id)
    expect(result.stages).toHaveLength(1)
  })

  it('prevents an owner from updating a foreign tournament', async () => {
    const organizationA = await seedOrganization('owner-a')
    const organizationB = await seedOrganization('owner-b')
    const { tournament } = await seedTournament(organizationB.id, 'Tournament B')
    const organizer = caller({ userId: 'owner-a', orgId: organizationA.id })

    await expect(
      organizer.tournament.update({ id: tournament.id, data: { name: 'Compromised' } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    const [unchanged] = await db
      .select({ name: schema.tournaments.name })
      .from(schema.tournaments)
      .where(eq(schema.tournaments.id, tournament.id))
    expect(unchanged?.name).toBe('Tournament B')
  })

  it('prevents a member from updating an organization tournament', async () => {
    const organization = await seedOrganization('member-a', 'member')
    const { tournament } = await seedTournament(organization.id, 'Tournament A')
    const member = caller({ userId: 'member-a', orgId: organization.id })

    await expect(
      member.tournament.update({ id: tournament.id, data: { name: 'Compromised' } }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('prevents an owner from registering a player in a foreign tournament', async () => {
    const organizationA = await seedOrganization('owner-a')
    const organizationB = await seedOrganization('owner-b')
    const { tournament, stage } = await seedTournament(organizationB.id, 'Tournament B')
    const squad = await seedSquad(stage.id)
    const player = await seedProfile(crypto.randomUUID(), 'player')
    const organizer = caller({ userId: 'owner-a', orgId: organizationA.id })

    await expect(
      organizer.tournament.registerPlayer({
        tournamentId: tournament.id,
        squadId: squad.id,
        playerId: player.id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    const registrations = await db.select().from(schema.tournamentPlayers)
    expect(registrations).toHaveLength(0)
  })

  it('prevents a member from registering a player', async () => {
    const organization = await seedOrganization('member-a', 'member')
    const { tournament, stage } = await seedTournament(organization.id, 'Tournament A')
    const squad = await seedSquad(stage.id)
    const player = await seedProfile(crypto.randomUUID(), 'player')
    const member = caller({ userId: 'member-a', orgId: organization.id })

    await expect(
      member.tournament.registerPlayer({
        tournamentId: tournament.id,
        squadId: squad.id,
        playerId: player.id,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects duplicate player registrations at the database boundary', async () => {
    const organization = await seedOrganization('owner-a')
    const { tournament, stage } = await seedTournament(organization.id, 'Tournament A')
    const squad = await seedSquad(stage.id)
    const player = await seedProfile(crypto.randomUUID(), 'player')
    const registration = {
      tournamentId: tournament.id,
      squadId: squad.id,
      profileId: player.id,
    }

    await db.insert(schema.tournamentPlayers).values(registration)

    await expect(db.insert(schema.tournamentPlayers).values(registration)).rejects.toMatchObject({
      code: '23505',
    })
  })

  it('rejects duplicate organization memberships at the database boundary', async () => {
    const organization = await seedOrganization('owner-a')
    const duplicateMembership = {
      organizationId: organization.id,
      profileId: 'owner-a',
      role: 'owner',
    }

    await expect(
      db.insert(schema.organizationMembers).values(duplicateMembership),
    ).rejects.toMatchObject({ code: '23505' })
  })
})
