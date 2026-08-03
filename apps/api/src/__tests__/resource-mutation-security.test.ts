import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@bowling/db'
import { appRouter } from '../routers'

const queryClient = postgres(
  process.env.DATABASE_URL ?? 'postgres://bowling:bowling@localhost:5432/bowling',
  { onnotice: () => {} },
)
const db = drizzle(queryClient, { schema })

function caller(userId: string | null, orgId: string | null) {
  return appRouter.createCaller({
    db,
    userId,
    orgId,
    ip: '198.51.100.40',
    req: {} as never,
    res: {} as never,
  })
}

type MembershipRole = 'owner' | 'admin' | 'scorer' | 'member'

type Resources = {
  tournamentId: string
  stageId: string
  tournamentPlayer1Id: string
  tournamentPlayer2Id: string
  openPoolId: string
  readyPoolId: string
  progressMatchId: string
  advancePoolId: string
  sidepotId: string
}

async function seedOrganization(
  suffix: string,
  member?: { profileId: string; role: MembershipRole },
) {
  if (member) {
    await db.insert(schema.profiles).values({
      id: member.profileId,
      firstName: 'Operator',
      lastName: suffix,
      email: `${member.profileId}@example.com`,
      role: 'organizer',
    })
  }

  const [organization] = await db
    .insert(schema.organizations)
    .values({ name: `Organization ${suffix}`, slug: `organization-${suffix}-${crypto.randomUUID()}` })
    .returning()
  if (!organization) throw new Error('Failed to seed organization')

  if (member) {
    await db.insert(schema.organizationMembers).values({
      organizationId: organization.id,
      profileId: member.profileId,
      role: member.role,
    })
  }

  return organization
}

async function seedResources(organizationId: string, suffix: string): Promise<Resources> {
  const [tournament] = await db
    .insert(schema.tournaments)
    .values({
      organizationId,
      name: `Tournament ${suffix}`,
      status: 'in_progress',
      startDate: new Date('2026-08-01T00:00:00Z'),
      endDate: new Date('2026-08-03T00:00:00Z'),
    })
    .returning()
  if (!tournament) throw new Error('Failed to seed tournament')

  const [stage] = await db
    .insert(schema.stages)
    .values({
      tournamentId: tournament.id,
      name: 'Qualifying',
      sortOrder: 0,
      format: {
        type: 'total_pins',
        gamesPerPlayer: 3,
        eventType: 'singles',
        scoring: { type: 'scratch', noTap: false },
      },
      advancement: { type: 'final' },
    })
    .returning()
  if (!stage) throw new Error('Failed to seed stage')

  const [squad] = await db
    .insert(schema.squads)
    .values({
      stageId: stage.id,
      name: 'Squad A',
      date: new Date('2026-08-01T09:00:00Z'),
      startTime: '09:00',
    })
    .returning()
  if (!squad) throw new Error('Failed to seed squad')

  const playerProfiles = await db
    .insert(schema.profiles)
    .values([
      {
        id: `authz-player-1-${suffix}`,
        firstName: 'Player',
        lastName: 'One',
        email: `player-1-${suffix}@example.com`,
        role: 'player',
        average: 180,
      },
      {
        id: `authz-player-2-${suffix}`,
        firstName: 'Player',
        lastName: 'Two',
        email: `player-2-${suffix}@example.com`,
        role: 'player',
        average: 190,
      },
    ])
    .returning()

  const tournamentPlayers = await db
    .insert(schema.tournamentPlayers)
    .values(playerProfiles.map((profile) => ({
      tournamentId: tournament.id,
      profileId: profile.id,
      squadId: squad.id,
    })))
    .returning()
  const [tp1, tp2] = tournamentPlayers
  if (!tp1 || !tp2) throw new Error('Failed to seed tournament players')

  const [openPool, readyPool, progressPool, advancePool] = await db
    .insert(schema.bracketPools)
    .values([
      { tournamentId: tournament.id, name: 'Open Pool', type: 'eight_person_forward' },
      { tournamentId: tournament.id, name: 'Ready Pool', type: 'eight_person_forward' },
      {
        tournamentId: tournament.id,
        name: 'Progress Pool',
        type: 'eight_person_forward',
        status: 'in_progress',
      },
      {
        tournamentId: tournament.id,
        name: 'Advance Pool',
        type: 'eight_person_forward',
        status: 'in_progress',
      },
    ])
    .returning()
  if (!openPool || !readyPool || !progressPool || !advancePool) {
    throw new Error('Failed to seed bracket pools')
  }

  await db.insert(schema.bracketEntries).values([
    { bracketPoolId: readyPool.id, tournamentPlayerId: tp1.id, entryNumber: 1 },
    { bracketPoolId: readyPool.id, tournamentPlayerId: tp2.id, entryNumber: 1 },
  ])

  const [progressRound, advanceRound] = await db
    .insert(schema.bracketRounds)
    .values([
      { bracketPoolId: progressPool.id, roundNumber: 1 },
      { bracketPoolId: advancePool.id, roundNumber: 1 },
    ])
    .returning()
  if (!progressRound || !advanceRound) throw new Error('Failed to seed bracket rounds')

  const [progressMatch] = await db
    .insert(schema.bracketMatches)
    .values({
      roundId: progressRound.id,
      position: 1,
      player1Id: tp1.id,
      player2Id: tp2.id,
    })
    .returning()
  if (!progressMatch) throw new Error('Failed to seed bracket match')

  await db.insert(schema.bracketMatches).values({
    roundId: advanceRound.id,
    position: 1,
    player1Id: tp1.id,
    player2Id: tp2.id,
    player1Score: 200,
    player2Score: 180,
    winnerId: tp1.id,
  })

  const [sidepot] = await db
    .insert(schema.sidepots)
    .values({
      tournamentId: tournament.id,
      name: 'High Game',
      type: 'high_game',
      entryFee: 1000,
    })
    .returning()
  if (!sidepot) throw new Error('Failed to seed sidepot')

  return {
    tournamentId: tournament.id,
    stageId: stage.id,
    tournamentPlayer1Id: tp1.id,
    tournamentPlayer2Id: tp2.id,
    openPoolId: openPool.id,
    readyPoolId: readyPool.id,
    progressMatchId: progressMatch.id,
    advancePoolId: advancePool.id,
    sidepotId: sidepot.id,
  }
}

const fakeId = '00000000-0000-0000-0000-000000000001'

function mutationCalls(
  c: ReturnType<typeof caller>,
  resources: Resources = {
    tournamentId: fakeId,
    stageId: fakeId,
    tournamentPlayer1Id: fakeId,
    tournamentPlayer2Id: '00000000-0000-0000-0000-000000000002',
    openPoolId: fakeId,
    readyPoolId: fakeId,
    progressMatchId: fakeId,
    advancePoolId: fakeId,
    sidepotId: fakeId,
  },
) {
  return {
    'squad.create': () => c.squad.create({
      stageId: resources.stageId,
      name: 'Unauthorized Squad',
      date: new Date('2026-08-01T10:00:00Z').toISOString(),
      startTime: '10:00',
      sortOrder: 1,
    }),
    'squad.enterScore': () => c.squad.enterScore({
      tournamentPlayerId: resources.tournamentPlayer1Id,
      gameNumber: 1,
      rawScore: 200,
      pins: [],
    }),
    'squad.batchEnterScores': () => c.squad.batchEnterScores({
      scores: [
        {
          tournamentPlayerId: resources.tournamentPlayer2Id,
          gameNumber: 1,
          rawScore: 190,
          pins: [],
        },
        {
          tournamentPlayerId: resources.tournamentPlayer2Id,
          gameNumber: 2,
          rawScore: 195,
          pins: [],
        },
      ],
    }),
    'bracket.createPool': () => c.bracket.createPool({
      tournamentId: resources.tournamentId,
      name: 'Unauthorized Pool',
      type: 'eight_person_forward',
      entryFee: 0,
      maxPlayers: 8,
      config: {},
    }),
    'bracket.joinPool': () => c.bracket.joinPool({
      poolId: resources.openPoolId,
      playerId: resources.tournamentPlayer1Id,
    }),
    'bracket.shuffle': () => c.bracket.shuffle({ poolId: resources.readyPoolId }),
    'bracket.enterScore': () => c.bracket.enterScore({
      matchId: resources.progressMatchId,
      player1Score: 210,
      player2Score: 180,
    }),
    'bracket.advanceRound': () => c.bracket.advanceRound({ poolId: resources.advancePoolId }),
    'sidepot.create': () => c.sidepot.create({
      tournamentId: resources.tournamentId,
      name: 'Unauthorized Sidepot',
      type: 'high_game',
      entryFee: 500,
    }),
    'sidepot.join': () => c.sidepot.join({
      sidepotId: resources.sidepotId,
      tournamentPlayerId: resources.tournamentPlayer1Id,
    }),
  }
}

const structuralMutationNames = [
  'squad.create',
  'bracket.createPool',
  'bracket.joinPool',
  'sidepot.create',
  'sidepot.join',
] as const

async function resetFixtures() {
  await queryClient`TRUNCATE organizations CASCADE`
  await queryClient`DELETE FROM profiles WHERE id LIKE 'authz-%'`
}

beforeEach(resetFixtures)

afterAll(async () => {
  await resetFixtures()
  await queryClient.end()
})

describe('nested tournament resource mutation authorization', () => {
  for (const mutationName of Object.keys(mutationCalls(caller(null, null)))) {
    it(`rejects anonymous ${mutationName}`, async () => {
      const call = mutationCalls(caller(null, null))[mutationName as keyof ReturnType<typeof mutationCalls>]
      await expect(call()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    })

    it(`rejects member role for ${mutationName}`, async () => {
      const organization = await seedOrganization(`member-${mutationName}`, {
        profileId: `authz-member-${mutationName}`,
        role: 'member',
      })
      const call = mutationCalls(caller(`authz-member-${mutationName}`, organization.id))[
        mutationName as keyof ReturnType<typeof mutationCalls>
      ]
      await expect(call()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it(`rejects cross-organization ${mutationName}`, async () => {
      const ownOrganization = await seedOrganization(`own-${mutationName}`, {
        profileId: `authz-owner-${mutationName}`,
        role: 'owner',
      })
      const foreignOrganization = await seedOrganization(`foreign-${mutationName}`)
      const resources = await seedResources(foreignOrganization.id, mutationName)
      const call = mutationCalls(caller(`authz-owner-${mutationName}`, ownOrganization.id), resources)[
        mutationName as keyof ReturnType<typeof mutationCalls>
      ]
      await expect(call()).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  }

  for (const mutationName of structuralMutationNames) {
    it(`rejects scorer role for structural mutation ${mutationName}`, async () => {
      const scorerId = `authz-scorer-denied-${mutationName}`
      const organization = await seedOrganization(`scorer-denied-${mutationName}`, {
        profileId: scorerId,
        role: 'scorer',
      })
      const call = mutationCalls(caller(scorerId, organization.id))[mutationName]
      await expect(call()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  }

  it.each(['owner', 'admin'] as const)(
    'allows %s role to manage owned squad, bracket, and sidepot structure',
    async (role) => {
      const operatorId = `authz-${role}-allowed`
      const organization = await seedOrganization(`${role}-allowed`, {
        profileId: operatorId,
        role,
      })
      const resources = await seedResources(organization.id, `${role}-allowed`)
      const calls = mutationCalls(caller(operatorId, organization.id), resources)

      await expect(calls['squad.create']()).resolves.toMatchObject({ stageId: resources.stageId })
      await expect(calls['bracket.createPool']()).resolves.toHaveProperty('id')
      await expect(calls['bracket.joinPool']()).resolves.toHaveProperty('id')
      await expect(calls['sidepot.create']()).resolves.toHaveProperty('id')
      await expect(calls['sidepot.join']()).resolves.toHaveProperty('id')
    },
  )

  it('allows a scorer to operate owned scores and bracket progression', async () => {
    const organization = await seedOrganization('scorer-allowed', {
      profileId: 'authz-scorer-allowed',
      role: 'scorer',
    })
    const resources = await seedResources(organization.id, 'scorer-allowed')
    const calls = mutationCalls(caller('authz-scorer-allowed', organization.id), resources)

    await expect(calls['squad.enterScore']()).resolves.toHaveProperty('id')
    await expect(calls['squad.batchEnterScores']()).resolves.toHaveLength(2)
    await expect(calls['bracket.shuffle']()).resolves.toMatchObject({ success: true })
    await expect(calls['bracket.enterScore']()).resolves.toHaveProperty('winnerId')
    await expect(calls['bracket.advanceRound']()).resolves.toMatchObject({
      success: true,
      completed: true,
    })
  })
})
