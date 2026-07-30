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

function caller(orgId?: string, userId = 'test-user') {
  return createCaller({ db, userId, orgId: orgId ?? null })
}

// ─── Helpers ───────────────────────────────────────────────────────

function makeStage(name: string, order: number, type: 'qualifying' | 'final' = 'qualifying') {
  return {
    name,
    order,
    format: {
      type: 'total_pins' as const,
      gamesPerPlayer: 3,
      eventType: 'singles' as const,
      scoring: { type: 'scratch' as const, noTap: false },
    },
    advancement:
      type === 'final'
        ? { type: 'final' as const }
        : { type: 'all_advance' as const, carryScores: true },
    squadConfig: null,
  }
}

const dummyCenterId = '00000000-0000-0000-0000-000000000000'

async function seedOrg(name = 'Test Org'): Promise<typeof allSchema.organizations.$inferSelect> {
  await db
    .insert(allSchema.profiles)
    .values({
      id: 'test-user',
      firstName: 'Test',
      lastName: 'Organizer',
      email: 'test-organizer@example.com',
      role: 'organizer',
    })
    .onConflictDoNothing()

  const [org] = await db
    .insert(allSchema.organizations)
    .values({ name, slug: `test-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })
    .returning()

  if (!org) {
    throw new Error('Failed to seed test organization')
  }

  await db.insert(allSchema.organizationMembers).values({
    organizationId: org.id,
    profileId: 'test-user',
    role: 'owner',
  })

  return org
}

// ─── Cleanup before each test ─────────────────────────────────────

beforeEach(async () => {
  await queryClient`TRUNCATE organizations CASCADE`
})

// ─── Tests ─────────────────────────────────────────────────────────

describe('tournament router', () => {
  it('rejects tournament creation without organization context', async () => {
    const c = caller()

    await expect(c.tournament.create({
      name: 'Unauthorized Tournament',
      description: null,
      centerId: dummyCenterId,
      category: 'open',
      maxPlayers: null,
      allowWaitlist: true,
      startDate: new Date('2026-05-01').toISOString(),
      endDate: new Date('2026-05-03').toISOString(),
      registrationDeadline: null,
      stages: [makeStage('Finals', 0, 'final')],
    })).rejects.toThrow(/organization context/i)
  })

  it('rejects tournament creation for a non-member organization', async () => {
    const org = await seedOrg()
    const c = caller(org.id, 'intruder')

    await expect(c.tournament.create({
      name: 'Cross Tenant Tournament',
      description: null,
      centerId: dummyCenterId,
      category: 'open',
      maxPlayers: null,
      allowWaitlist: true,
      startDate: new Date('2026-05-01').toISOString(),
      endDate: new Date('2026-05-03').toISOString(),
      registrationDeadline: null,
      stages: [makeStage('Finals', 0, 'final')],
    })).rejects.toThrow(/do not belong/i)
  })

  it('creates a tournament with stages → returns id', async () => {
    const org = await seedOrg()
    const c = caller(org.id)

    const result = await c.tournament.create({
      name: 'Spring Classic',
      description: null,
      centerId: dummyCenterId,
      category: 'open',
      maxPlayers: null,
      allowWaitlist: true,
      startDate: new Date('2026-06-01').toISOString(),
      endDate: new Date('2026-06-03').toISOString(),
      registrationDeadline: null,
      stages: [makeStage('Qualifying', 0, 'final')],
    })

    expect(result).toHaveProperty('id')
    expect(typeof result.id).toBe('string')
    expect(result.id).toHaveLength(36) // UUID length

    // Verify it was persisted
    const [saved] = await db
      .select()
      .from(allSchema.tournaments)
      .where(eq(allSchema.tournaments.id, result.id))
    expect(saved).toBeDefined()
    expect(saved!.name).toBe('Spring Classic')
  })

  it('rolls back the tournament when a stage insert fails', async () => {
    const org = await seedOrg()
    const c = caller(org.id)
    const tournamentName = 'Rollback Tournament'

    await queryClient`
      CREATE OR REPLACE FUNCTION reject_rollback_test_stage()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.name = 'FORCE_STAGE_ROLLBACK' THEN
          RAISE EXCEPTION 'forced stage insert failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `
    await queryClient`
      CREATE TRIGGER reject_rollback_test_stage_trigger
      BEFORE INSERT ON stages
      FOR EACH ROW EXECUTE FUNCTION reject_rollback_test_stage()
    `

    try {
      await expect(c.tournament.create({
        name: tournamentName,
        description: null,
        centerId: dummyCenterId,
        category: 'open',
        maxPlayers: null,
        allowWaitlist: true,
        startDate: new Date('2026-06-01').toISOString(),
        endDate: new Date('2026-06-03').toISOString(),
        registrationDeadline: null,
        stages: [makeStage('FORCE_STAGE_ROLLBACK', 0, 'final')],
      })).rejects.toThrow(/forced stage insert failure/i)

      const saved = await db
        .select({ id: allSchema.tournaments.id })
        .from(allSchema.tournaments)
        .where(eq(allSchema.tournaments.name, tournamentName))

      expect(saved).toHaveLength(0)
    } finally {
      await queryClient`DROP TRIGGER IF EXISTS reject_rollback_test_stage_trigger ON stages`
      await queryClient`DROP FUNCTION IF EXISTS reject_rollback_test_stage()`
    }
  })

  it('gets a tournament by id → includes stages', async () => {
    const org = await seedOrg()
    const c = caller(org.id)

    const { id } = await c.tournament.create({
      name: 'Summer Championship',
      description: 'Annual summer event',
      centerId: dummyCenterId,
      category: 'open',
      maxPlayers: 64,
      allowWaitlist: true,
      startDate: new Date('2026-07-15').toISOString(),
      endDate: new Date('2026-07-18').toISOString(),
      registrationDeadline: new Date('2026-07-01').toISOString(),
      stages: [
        makeStage('Qualifying', 0),
        makeStage('Finals', 1, 'final'),
      ],
    })

    const tournament = await c.tournament.byId(id)
    expect(tournament.id).toBe(id)
    expect(tournament.name).toBe('Summer Championship')
    expect(tournament.stages).toHaveLength(2)
    expect(tournament.stages[0]!.name).toBe('Qualifying')
    expect(tournament.stages[1]!.name).toBe('Finals')
  })

  it('lists tournaments with pagination', async () => {
    const org = await seedOrg()
    const c = caller(org.id)

    // Create 3 tournaments
    for (let i = 0; i < 3; i++) {
      await c.tournament.create({
        name: `Tournament ${i + 1}`,
        description: null,
        centerId: dummyCenterId,
        category: 'open',
        maxPlayers: null,
        allowWaitlist: true,
        startDate: new Date('2026-08-01').toISOString(),
        endDate: new Date('2026-08-03').toISOString(),
        registrationDeadline: null,
        stages: [makeStage('Qualifying', 0, 'final')],
      })
    }

    // Fetch with limit=2 → returns 2 items, nextCursor present (more exist)
    const page1 = await c.tournament.list({ limit: 2 })
    expect(page1.items).toHaveLength(2)
    expect(page1.nextCursor).toBeTruthy()
    // Items sorted newest-first (Tournament 3, Tournament 2)
    expect(page1.items[0]!.name).toBe('Tournament 3')
    expect(page1.items[1]!.name).toBe('Tournament 2')

    // Fetch with limit=10 → returns all 3, nextCursor null (no more)
    const all = await c.tournament.list({ limit: 10 })
    expect(all.items).toHaveLength(3)
    expect(all.nextCursor).toBeNull()
  })

  it('updates a tournament field', async () => {
    const org = await seedOrg()
    const c = caller(org.id)

    const { id } = await c.tournament.create({
      name: 'Original Name',
      description: null,
      centerId: dummyCenterId,
      category: 'open',
      maxPlayers: null,
      allowWaitlist: true,
      startDate: new Date('2026-09-01').toISOString(),
      endDate: new Date('2026-09-03').toISOString(),
      registrationDeadline: null,
      stages: [makeStage('Qualifying', 0, 'final')],
    })

    const updateResult = await c.tournament.update({
      id,
      data: { name: 'Updated Name' },
    })
    expect(updateResult.success).toBe(true)

    // Verify
    const updated = await c.tournament.byId(id)
    expect(updated.name).toBe('Updated Name')
  })

  it('fails when creating a tournament without stages', async () => {
    const org = await seedOrg()
    const c = caller(org.id)

    // @ts-expect-error — intentionally omitting stages to test validation
    const promise = c.tournament.create({
      name: 'No Stages',
      description: null,
      centerId: dummyCenterId,
      category: 'open',
      maxPlayers: null,
      allowWaitlist: true,
      startDate: new Date('2026-10-01').toISOString(),
      endDate: new Date('2026-10-03').toISOString(),
      registrationDeadline: null,
    })

    await expect(promise).rejects.toThrow()
  })

  it('fails with empty stages array', async () => {
    const org = await seedOrg()
    const c = caller(org.id)

    const promise = c.tournament.create({
      name: 'Empty Stages',
      description: null,
      centerId: dummyCenterId,
      category: 'open',
      maxPlayers: null,
      allowWaitlist: true,
      startDate: new Date('2026-11-01').toISOString(),
      endDate: new Date('2026-11-03').toISOString(),
      registrationDeadline: null,
      stages: [],
    })

    await expect(promise).rejects.toThrow(TRPCError)
  })

  it('throws NOT_FOUND for non-existent tournament', async () => {
    const c = caller()
    const fakeId = '00000000-0000-0000-0000-000000000001'

    await expect(c.tournament.byId(fakeId)).rejects.toThrow(
      /not found/i,
    )
  })

  it('throws NOT_FOUND when updating non-existent tournament', async () => {
    const c = caller()
    const fakeId = '00000000-0000-0000-0000-000000000002'

    await expect(
      c.tournament.update({ id: fakeId, data: { name: 'Nope' } }),
    ).rejects.toThrow(TRPCError)
  })
})
