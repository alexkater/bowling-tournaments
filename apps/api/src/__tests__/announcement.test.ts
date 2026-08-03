import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@bowling/db'
import { appRouter } from '../routers'

const queryClient = postgres(
  process.env.DATABASE_URL ?? 'postgres://bowling:bowling@localhost:5432/bowling',
  { max: 1 },
)
const db = drizzle(queryClient, { schema })

function caller(userId: string, orgId: string, ip = '198.51.100.77') {
  return appRouter.createCaller({
    db,
    userId,
    orgId,
    ip,
    req: {} as never,
    res: {} as never,
  })
}

async function seedProfile(id: string, role: 'player' | 'organizer' = 'player') {
  await db.insert(schema.profiles).values({
    id,
    firstName: role === 'organizer' ? 'Organizer' : 'Player',
    lastName: id,
    email: `${id}@example.test`,
    role,
  }).onConflictDoNothing()
}

async function seedOrganization(ownerId: string, memberRole = 'owner') {
  await seedProfile(ownerId, 'organizer')
  const [organization] = await db.insert(schema.organizations).values({
    name: `Organization ${ownerId}`,
    slug: `organization-${crypto.randomUUID()}`,
  }).returning()
  if (!organization) throw new Error('Failed to seed organization')
  await db.insert(schema.organizationMembers).values({
    organizationId: organization.id,
    profileId: ownerId,
    role: memberRole,
  })
  return organization
}

async function seedTournament(organizationId: string, playerIds: string[]) {
  const startDate = new Date(Date.now() + 7 * 24 * 60 * 60_000)
  const [tournament] = await db.insert(schema.tournaments).values({
    organizationId,
    name: `Announcement Tournament ${crypto.randomUUID()}`,
    status: 'published',
    startDate,
    endDate: new Date(startDate.getTime() + 24 * 60 * 60_000),
  }).returning()
  if (!tournament) throw new Error('Failed to seed tournament')

  const [stage] = await db.insert(schema.stages).values({
    tournamentId: tournament.id,
    name: 'Stage',
    sortOrder: 0,
    format: { type: 'total_pins', gamesPerPlayer: 3 },
    advancement: { type: 'final' },
  }).returning()
  if (!stage) throw new Error('Failed to seed stage')

  const [squad] = await db.insert(schema.squads).values({
    stageId: stage.id,
    name: 'Squad A',
    date: startDate,
    startTime: '09:00',
  }).returning()
  if (!squad) throw new Error('Failed to seed squad')

  for (const [index, profileId] of playerIds.entries()) {
    await seedProfile(profileId)
    await db.insert(schema.tournamentPlayers).values({
      tournamentId: tournament.id,
      profileId,
      squadId: squad.id,
      status: index === 0 ? 'confirmed' : 'waitlisted',
    })
  }

  return tournament
}

beforeEach(async () => {
  await queryClient`DELETE FROM auth_rate_limits`
  await queryClient`DROP TABLE IF EXISTS pg_temp.notifications`
  await queryClient`DROP TABLE IF EXISTS pg_temp.email_logs`
  await queryClient`
    CREATE TEMP TABLE notifications (
      id text PRIMARY KEY,
      "profileId" text NOT NULL,
      type text NOT NULL,
      title text NOT NULL,
      body text NOT NULL,
      metadata jsonb DEFAULT '{}'::jsonb,
      read boolean NOT NULL DEFAULT false,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `
  await queryClient`
    CREATE TEMP TABLE email_logs (
      id text PRIMARY KEY,
      "idempotencyKey" text NOT NULL UNIQUE,
      "profileId" text,
      "to" text NOT NULL,
      template text NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      status text NOT NULL DEFAULT 'pending',
      attempts integer NOT NULL DEFAULT 0,
      "maxAttempts" integer NOT NULL DEFAULT 5,
      "nextAttemptAt" timestamptz NOT NULL DEFAULT now(),
      "lockedAt" timestamptz,
      "providerMessageId" text,
      error text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "sentAt" timestamptz
    )
  `
  await queryClient`TRUNCATE organizations CASCADE`
})

afterAll(async () => {
  await queryClient.end()
})

describe('organizer announcements', () => {
  it('queues in-app and email delivery once for confirmed and waitlisted players', async () => {
    const organization = await seedOrganization('announcement-owner')
    const tournament = await seedTournament(organization.id, ['announcement-player-a', 'announcement-player-b'])
    const clientMutationId = '11111111-1111-4111-8111-111111111111'

    const input = {
      tournamentId: tournament.id,
      clientMutationId,
      subject: 'Cambio de horario',
      body: 'El squad comienza a las 10:00.',
    }
    const first = await caller('announcement-owner', organization.id).notification.broadcast(input)
    const second = await caller('announcement-owner', organization.id).notification.broadcast(input)

    const notificationRows = await db
      .select()
      .from(schema.notifications)
      .where(and(
        eq(schema.notifications.type, 'announcement'),
        inArray(schema.notifications.profileId, ['announcement-player-a', 'announcement-player-b']),
      ))
    const emailRows = await db
      .select()
      .from(schema.emailLogs)
      .where(eq(schema.emailLogs.template, 'announcement'))

    expect(first).toEqual({ recipients: 2 })
    expect(second).toEqual({ recipients: 2 })
    expect(notificationRows).toHaveLength(2)
    expect(emailRows).toHaveLength(2)
  })

  it('rate limits the sixth distinct announcement in ten minutes', async () => {
    const organization = await seedOrganization('announcement-rate-owner')
    const tournament = await seedTournament(organization.id, ['announcement-rate-player'])
    const c = caller('announcement-rate-owner', organization.id, '203.0.113.108')

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(c.notification.broadcast({
        tournamentId: tournament.id,
        clientMutationId: crypto.randomUUID(),
        subject: `Aviso ${attempt + 1}`,
        body: 'Mensaje válido.',
      })).resolves.toEqual({ recipients: 1 })
    }
    await expect(c.notification.broadcast({
      tournamentId: tournament.id,
      clientMutationId: crypto.randomUUID(),
      subject: 'Aviso 6',
      body: 'Debe bloquearse.',
    })).rejects.toThrow(/too many announcements/i)
  })

  it('hides tournaments owned by another organization', async () => {
    const organizationA = await seedOrganization('announcement-owner-a')
    const organizationB = await seedOrganization('announcement-owner-b')
    const tournamentB = await seedTournament(organizationB.id, ['announcement-player-cross-org'])

    await expect(caller('announcement-owner-a', organizationA.id).notification.broadcast({
      tournamentId: tournamentB.id,
      clientMutationId: '22222222-2222-4222-8222-222222222222',
      subject: 'Unauthorized',
      body: 'Must not be delivered.',
    })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('requires owner or admin role', async () => {
    const organization = await seedOrganization('announcement-member', 'member')
    const tournament = await seedTournament(organization.id, ['announcement-player-member-role'])

    await expect(caller('announcement-member', organization.id).notification.broadcast({
      tournamentId: tournament.id,
      clientMutationId: '33333333-3333-4333-8333-333333333333',
      subject: 'Unauthorized role',
      body: 'Must not be delivered.',
    })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
