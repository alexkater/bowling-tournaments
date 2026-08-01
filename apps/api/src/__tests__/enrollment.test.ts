import { beforeEach, describe, expect, it } from 'vitest'
import { initTRPC } from '@trpc/server'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, and } from 'drizzle-orm'
import postgres from 'postgres'
import superjson from 'superjson'
import * as schema from '@bowling/db'
import { appRouter } from '../routers'

const queryClient = postgres(
  process.env.DATABASE_URL ?? 'postgres://bowling:bowling@localhost:5432/bowling',
  { max: 1 },
)
const db = drizzle(queryClient, { schema })

const t = initTRPC
  .context<{ db: typeof db; userId: string | null; orgId: string | null }>()
  .create({ transformer: superjson })
const createCaller = t.createCallerFactory(appRouter)

function caller(context: { userId: string | null; orgId?: string | null }) {
  return createCaller({ db, ...context, orgId: context.orgId ?? null })
}

// ─── Seed helpers (matching existing test patterns) ───

async function seedProfile(id: string, role: 'organizer' | 'player' = 'player') {
  await db
    .insert(schema.profiles)
    .values({ id, firstName: role === 'player' ? 'Player' : 'Org', lastName: id.slice(0, 8), email: `${id}@test.com`, role })
    .onConflictDoNothing()
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.id, id)).limit(1)
  if (!profile) throw new Error('Failed to seed profile')
  return profile
}

async function seedOrganization(profileId: string) {
  await seedProfile(profileId, 'organizer')
  const [org] = await db
    .insert(schema.organizations)
    .values({ name: `Org ${profileId.slice(0, 8)}`, slug: `org-${crypto.randomUUID()}` })
    .returning()
  if (!org) throw new Error('Failed to seed org')
  await db.insert(schema.organizationMembers).values({ organizationId: org.id, profileId, role: 'owner' })
  return org
}

async function seedTournament(
  orgId: string,
  overrides: Partial<{
    name: string
    status: 'draft' | 'published' | 'in_progress' | 'completed'
    maxPlayers: number | null
    allowWaitlist: boolean
    registrationDeadline: Date | null
  }> = {},
) {
  const now = new Date()
  const future = new Date(now.getTime() + 30 * 24 * 3600_000)
  const [tournament] = await db
    .insert(schema.tournaments)
    .values({
      organizationId: orgId,
      name: overrides.name ?? `T ${Date.now()}`,
      status: overrides.status ?? 'published',
      maxPlayers: overrides.maxPlayers ?? null,
      allowWaitlist: overrides.allowWaitlist ?? true,
      registrationDeadline: overrides.registrationDeadline ?? new Date(future.getTime() - 24 * 3600_000),
      startDate: future,
      endDate: new Date(future.getTime() + 7 * 24 * 3600_000),
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

  const [squad] = await db
    .insert(schema.squads)
    .values({ stageId: stage.id, name: 'Squad A', date: future, startTime: '09:00' })
    .returning()
  if (!squad) throw new Error('Failed to seed squad')

  return { tournament, stage, squad }
}

// ─── Before each ───

beforeEach(async () => {
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

// ─── Tests ───

describe('enrollment router — self-service registration', () => {
  let orgId: string
  let tournamentId: string
  let squadId: string

  beforeEach(async () => {
    const org = await seedOrganization('org-owner')
    orgId = org.id
    const seeded = await seedTournament(orgId, { maxPlayers: 10, allowWaitlist: true })
    tournamentId = seeded.tournament.id
    squadId = seeded.squad.id
  })

  // ── Registration ──

  it('registers a player to a published tournament', async () => {
    const profileId = 'reg-player-1'
    await seedProfile(profileId)

    const result = await caller({ userId: profileId }).enrollment.register({ tournamentId })

    expect(result.status).toBe('confirmed')
    expect(result.tournamentId).toBe(tournamentId)
    expect(result.profileId).toBe(profileId)
  })

  it('rejects registration for a draft tournament', async () => {
    const draft = await seedTournament(orgId, { status: 'draft' })
    const pid = 'reg-player-draft'
    await seedProfile(pid)

    await expect(
      caller({ userId: pid }).enrollment.register({ tournamentId: draft.tournament.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('rejects registration after the deadline has passed', async () => {
    const pastDeadline = await seedTournament(orgId, {
      registrationDeadline: new Date(Date.now() - 24 * 3600_000),
    })
    const pid = 'reg-player-late'
    await seedProfile(pid)

    await expect(
      caller({ userId: pid }).enrollment.register({ tournamentId: pastDeadline.tournament.id }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' })
  })

  it('rejects duplicate registration', async () => {
    const pid = 'reg-player-dup'
    await seedProfile(pid)
    const c = caller({ userId: pid })

    await c.enrollment.register({ tournamentId })
    await expect(c.enrollment.register({ tournamentId })).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('rolls back registration when communication persistence fails', async () => {
    const pid = 'reg-player-rollback'
    await seedProfile(pid)
    await queryClient`
      ALTER TABLE notifications
      ADD CONSTRAINT reject_enrollment_notification
      CHECK (type <> 'enrollment_confirmed')
    `

    await expect(caller({ userId: pid }).enrollment.register({ tournamentId })).rejects.toBeDefined()

    const registrations = await db
      .select()
      .from(schema.tournamentPlayers)
      .where(and(
        eq(schema.tournamentPlayers.tournamentId, tournamentId),
        eq(schema.tournamentPlayers.profileId, pid),
      ))
    expect(registrations).toHaveLength(0)
  })

  it('waitlists a player when tournament is full', async () => {
    const tiny = await seedTournament(orgId, { maxPlayers: 1, allowWaitlist: true })
    const pid1 = 'reg-player-full-1'
    const pid2 = 'reg-player-full-2'
    await seedProfile(pid1)
    await seedProfile(pid2)

    await caller({ userId: pid1 }).enrollment.register({ tournamentId: tiny.tournament.id })
    const result = await caller({ userId: pid2 }).enrollment.register({ tournamentId: tiny.tournament.id })

    expect(result.status).toBe('waitlisted')
  })

  it('rejects registration when full and waitlist disabled', async () => {
    const noWait = await seedTournament(orgId, { maxPlayers: 1, allowWaitlist: false })
    const pid1 = 'reg-player-nowait-1'
    const pid2 = 'reg-player-nowait-2'
    await seedProfile(pid1)
    await seedProfile(pid2)

    await caller({ userId: pid1 }).enrollment.register({ tournamentId: noWait.tournament.id })

    await expect(
      caller({ userId: pid2 }).enrollment.register({ tournamentId: noWait.tournament.id }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' })
  })

  it('rejects unauthenticated registration', async () => {
    await expect(
      caller({ userId: null }).enrollment.register({ tournamentId }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  // ── Cancellation ──

  it('cancels own registration and promotes a waitlisted player', async () => {
    const tiny = await seedTournament(orgId, { maxPlayers: 1, allowWaitlist: true })
    const pidA = 'cancel-player-a'
    const pidB = 'cancel-player-b'
    await seedProfile(pidA)
    await seedProfile(pidB)

    await caller({ userId: pidA }).enrollment.register({ tournamentId: tiny.tournament.id })
    const waitResult = await caller({ userId: pidB }).enrollment.register({ tournamentId: tiny.tournament.id })
    expect(waitResult.status).toBe('waitlisted')

    await caller({ userId: pidA }).enrollment.cancel({ tournamentId: tiny.tournament.id })

    const [bRow] = await db
      .select()
      .from(schema.tournamentPlayers)
      .where(eq(schema.tournamentPlayers.profileId, pidB))
    expect(bRow.status).toBe('confirmed')

    const cancelledNotifications = await db
      .select()
      .from(schema.notifications)
      .where(and(
        eq(schema.notifications.profileId, pidA),
        eq(schema.notifications.type, 'enrollment_cancelled'),
      ))
    const [cancellationEmail] = await db
      .select()
      .from(schema.emailLogs)
      .where(and(
        eq(schema.emailLogs.profileId, pidA),
        eq(schema.emailLogs.template, 'cancellation'),
      ))
    const [promotionNotification] = await db
      .select()
      .from(schema.notifications)
      .where(and(
        eq(schema.notifications.profileId, pidB),
        eq(schema.notifications.type, 'promoted'),
      ))

    expect(cancelledNotifications).toHaveLength(1)
    expect(cancellationEmail?.status).toBe('pending')
    expect(promotionNotification?.title).toContain(tiny.tournament.name)
  })

  it('rolls back cancellation when communication persistence fails', async () => {
    const pid = 'cancel-player-rollback'
    await seedProfile(pid)
    await caller({ userId: pid }).enrollment.register({ tournamentId })
    await queryClient`
      ALTER TABLE email_logs
      ADD CONSTRAINT reject_cancellation_email
      CHECK (template <> 'cancellation')
    `

    await expect(caller({ userId: pid }).enrollment.cancel({ tournamentId })).rejects.toBeDefined()

    const [registration] = await db
      .select()
      .from(schema.tournamentPlayers)
      .where(and(
        eq(schema.tournamentPlayers.tournamentId, tournamentId),
        eq(schema.tournamentPlayers.profileId, pid),
      ))
    expect(registration?.status).toBe('confirmed')
  })

  it('prevents cancelling registration of another player', async () => {
    const pidA = 'cancel-player-a2'
    const pidB = 'cancel-player-b2'
    await seedProfile(pidA)
    await seedProfile(pidB)

    await caller({ userId: pidA }).enrollment.register({ tournamentId })

    await expect(
      caller({ userId: pidB }).enrollment.cancel({ tournamentId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  // ── My tournaments ──

  it('returns only the authenticated player registrations', async () => {
    const pidA = 'my-player-a'
    const pidB = 'my-player-b'
    await seedProfile(pidA)
    await seedProfile(pidB)

    await caller({ userId: pidA }).enrollment.register({ tournamentId })
    await caller({ userId: pidB }).enrollment.register({ tournamentId })

    const aList = await caller({ userId: pidA }).enrollment.myTournaments()
    expect(aList).toHaveLength(1)
    expect(aList[0].profileId).toBe(pidA)

    const bList = await caller({ userId: pidB }).enrollment.myTournaments()
    expect(bList).toHaveLength(1)
    expect(bList[0].profileId).toBe(pidB)
  })

  it('includes both confirmed and waitlisted tournaments', async () => {
    const tiny = await seedTournament(orgId, { maxPlayers: 1, allowWaitlist: true })
    const pid = 'my-player-both'
    await seedProfile(pid)
    const pidFiller = 'my-player-filler'
    await seedProfile(pidFiller)

    // Fill the tiny tournament with another player
    await caller({ userId: pidFiller }).enrollment.register({ tournamentId: tiny.tournament.id })

    // Register our player in both tournaments
    await caller({ userId: pid }).enrollment.register({ tournamentId })
    await caller({ userId: pid }).enrollment.register({ tournamentId: tiny.tournament.id })

    const list = await caller({ userId: pid }).enrollment.myTournaments()
    expect(list).toHaveLength(2)

    const confirmed = list.filter((e) => e.status === 'confirmed')
    const waitlisted = list.filter((e) => e.status === 'waitlisted')
    expect(confirmed).toHaveLength(1)
    expect(waitlisted).toHaveLength(1)
  })

  it('rejects myTournaments for unauthenticated users', async () => {
    await expect(caller({ userId: null }).enrollment.myTournaments()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })
})
