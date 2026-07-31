import { describe, it, expect, beforeEach } from 'vitest'
import { initTRPC } from '@trpc/server'
import superjson from 'superjson'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as allSchema from '@bowling/db'
import { appRouter } from '../routers'

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

function caller(userId?: string) {
  return createCaller({ db, userId: userId ?? null, orgId: null })
}

// ─── Cleanup before each test ─────────────────────────────────────

beforeEach(async () => {
  await queryClient`TRUNCATE profiles CASCADE`
})

// ─── Tests ─────────────────────────────────────────────────────────

describe('auth router', () => {
  const newUser = {
    email: 'test@example.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
  }

  it('signup: creates profile + credentials, returns token', async () => {
    const c = caller()
    const result = await c.auth.signup(newUser)

    // Returns a JWT token
    expect(result).toHaveProperty('token')
    expect(typeof result.token).toBe('string')
    expect(result.token.split('.')).toHaveLength(3) // JWT has 3 parts

    // Returns profile with correct fields
    expect(result.profile).toMatchObject({
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
    })
    expect(result.profile).toHaveProperty('id')
    expect(result.profile.id).toHaveLength(36) // UUID

    // Verify profile was persisted
    const [saved] = await db
      .select()
      .from(allSchema.profiles)
      .where(eq(allSchema.profiles.id, result.profile.id))
    expect(saved).toBeDefined()
    expect(saved!.email).toBe(newUser.email)

    // Verify credentials were persisted
    const [cred] = await db
      .select()
      .from(allSchema.userCredentials)
      .where(eq(allSchema.userCredentials.email, newUser.email))
    expect(cred).toBeDefined()
    expect(cred!.profileId).toBe(result.profile.id)

    const [provisioning] = await db
      .select({
        profileRole: allSchema.profiles.role,
        membershipRole: allSchema.organizationMembers.role,
        organizationName: allSchema.organizations.name,
      })
      .from(allSchema.profiles)
      .innerJoin(
        allSchema.organizationMembers,
        eq(allSchema.organizationMembers.profileId, allSchema.profiles.id),
      )
      .innerJoin(
        allSchema.organizations,
        eq(allSchema.organizations.id, allSchema.organizationMembers.organizationId),
      )
      .where(eq(allSchema.profiles.id, result.profile.id))

    expect(provisioning).toMatchObject({
      profileRole: 'organizer',
      membershipRole: 'owner',
      organizationName: 'Test User Organization',
    })
  })

  it('signup: creates a player without provisioning an organization', async () => {
    const result = await caller().auth.signup({
      ...newUser,
      email: 'player@example.com',
      accountType: 'player',
    })

    expect(result.profile).toMatchObject({
      email: 'player@example.com',
      role: 'player',
    })

    const memberships = await db
      .select()
      .from(allSchema.organizationMembers)
      .where(eq(allSchema.organizationMembers.profileId, result.profile.id))

    expect(memberships).toHaveLength(0)
  })

  it('signup: duplicate email returns CONFLICT', async () => {
    const c = caller()
    await c.auth.signup(newUser)

    await expect(c.auth.signup(newUser)).rejects.toThrow(/already registered/i)

    // Verify only one profile was created
    const profiles = await db
      .select()
      .from(allSchema.profiles)
      .where(eq(allSchema.profiles.email, newUser.email))
    expect(profiles).toHaveLength(1)
  })

  it('signup: provisioned organizer creates a tournament without an organization header', async () => {
    const { profile } = await caller().auth.signup(newUser)
    const authed = caller(profile.id)

    const result = await authed.tournament.create({
      name: 'First Tournament',
      description: null,
      centerId: '00000000-0000-0000-0000-000000000000',
      category: 'open',
      maxPlayers: null,
      allowWaitlist: true,
      startDate: new Date('2026-08-01').toISOString(),
      endDate: new Date('2026-08-03').toISOString(),
      registrationDeadline: null,
      stages: [{
        name: 'Finals',
        order: 0,
        format: {
          type: 'total_pins',
          gamesPerPlayer: 3,
          eventType: 'singles',
          scoring: { type: 'scratch', noTap: false },
        },
        advancement: { type: 'final' },
        squadConfig: null,
      }],
    })

    const [membership] = await db
      .select({ organizationId: allSchema.organizationMembers.organizationId })
      .from(allSchema.organizationMembers)
      .where(eq(allSchema.organizationMembers.profileId, profile.id))
    const [tournament] = await db
      .select({ organizationId: allSchema.tournaments.organizationId })
      .from(allSchema.tournaments)
      .where(eq(allSchema.tournaments.id, result.id))

    expect(tournament?.organizationId).toBe(membership?.organizationId)
  })

  it('login: correct credentials returns token and profile', async () => {
    const c = caller()
    await c.auth.signup(newUser)

    const result = await c.auth.login({
      email: newUser.email,
      password: newUser.password,
    })

    expect(result).toHaveProperty('token')
    expect(typeof result.token).toBe('string')
    expect(result.token.split('.')).toHaveLength(3)

    expect(result.profile).toMatchObject({
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
    })
  })

  it('login: wrong password returns UNAUTHORIZED', async () => {
    const c = caller()
    await c.auth.signup(newUser)

    await expect(
      c.auth.login({ email: newUser.email, password: 'wrongpassword' }),
    ).rejects.toThrow(/Invalid email or password/)
  })

  it('login: non-existent email returns UNAUTHORIZED', async () => {
    const c = caller()

    await expect(
      c.auth.login({ email: 'nonexistent@example.com', password: 'password123' }),
    ).rejects.toThrow(/Invalid email or password/)
  })

  it('me: valid token returns profile', async () => {
    const c = caller()
    const { profile } = await c.auth.signup(newUser)

    // Create an authenticated caller with the profile id (simulating JWT auth)
    const authed = caller(profile.id)
    const me = await authed.auth.me()

    expect(me).toMatchObject({
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
    })
    expect(me.id).toBe(profile.id)
  })

  it('me: no token throws UNAUTHORIZED', async () => {
    const c = caller()
    await expect(c.auth.me()).rejects.toThrow(/Not authenticated/i)
  })
})
