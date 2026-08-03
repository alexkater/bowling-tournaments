import { describe, it, expect, beforeEach } from 'vitest'

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as allSchema from '@bowling/db'
import { appRouter } from '../routers'
import { createContext } from '../context'
import { decryptActionUrl } from '../services/account-security'

// ─── Test DB connection ────────────────────────────────────────────

const queryClient = postgres(
  process.env.DATABASE_URL ?? 'postgres://bowling:bowling@localhost:5432/bowling',
)
const db = drizzle(queryClient, { schema: allSchema })

// ─── tRPC test caller ─────────────────────────────────────────────

function caller(userId?: string, ip = '198.51.100.25') {
  return appRouter.createCaller({
    db,
    userId: userId ?? null,
    orgId: null,
    ip,
    req: {} as never,
    res: {} as never,
  })
}

async function signupVerifyAndLogin(input: {
  email: string
  password: string
  firstName: string
  lastName: string
  accountType?: 'player' | 'organizer'
}) {
  const c = caller()
  await c.auth.signup(input)
  const normalizedEmail = input.email.trim().toLowerCase()
  const [verificationEmail] = await queryClient<{ payload: Record<string, string> }[]>`
    SELECT payload FROM email_logs
    WHERE template = 'verify_email' AND "to" = ${normalizedEmail}
    ORDER BY "createdAt" DESC LIMIT 1
  `
  const actionUrl = decryptActionUrl(
    verificationEmail.payload.actionUrlEncrypted,
    process.env.JWT_SECRET!,
  )
  await c.auth.verifyEmail({ token: new URL(actionUrl).searchParams.get('token')! })
  return c.auth.login({ email: normalizedEmail, password: input.password })
}

// ─── Cleanup before each test ─────────────────────────────────────

beforeEach(async () => {
  // Delete in reverse dependency order.
  await queryClient`DELETE FROM auth_rate_limits`
  await queryClient`DELETE FROM auth_tokens`
  await queryClient`DELETE FROM email_logs`
  await queryClient`DELETE FROM notifications`
  await queryClient`DELETE FROM tournament_players`
  await queryClient`DELETE FROM organization_members`
  await queryClient`DELETE FROM user_credentials`
  await queryClient`DELETE FROM profiles`
})

// ─── Tests ─────────────────────────────────────────────────────────

describe('auth router', () => {
  const newUser = {
    email: 'test@example.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
  }

  it('signup: creates an unverified account and queues a hashed verification token without a session', async () => {
    const result = await caller().auth.signup({
      ...newUser,
      email: 'New.Player@Example.com',
      accountType: 'player',
    })

    expect(result).toEqual({ requiresVerification: true })
    expect(result).not.toHaveProperty('token')

    const [credential] = await queryClient<{
      profileId: string
      email: string
      emailVerifiedAt: Date | null
    }[]>`
      SELECT "profileId", email, "emailVerifiedAt"
      FROM user_credentials
      WHERE email = 'new.player@example.com'
    `
    expect(credential).toMatchObject({
      email: 'new.player@example.com',
      emailVerifiedAt: null,
    })

    const [token] = await queryClient<{
      tokenHash: string
      type: string
      usedAt: Date | null
      expiresAt: Date | string
    }[]>`
      SELECT "tokenHash", type, "usedAt", "expiresAt"
      FROM auth_tokens
      WHERE "profileId" = ${credential.profileId}
    `
    expect(token).toMatchObject({
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      type: 'email_verification',
      usedAt: null,
    })
    expect(new Date(token.expiresAt).getTime()).toBeGreaterThan(Date.now())

    const [email] = await queryClient<{ template: string; payload: Record<string, string> }[]>`
      SELECT template, payload FROM email_logs WHERE "profileId" = ${credential.profileId}
    `
    expect(email.template).toBe('verify_email')
    expect(email.payload.actionUrlEncrypted).toBeTruthy()
    expect(JSON.stringify(email.payload)).not.toContain('token=')
  })

  it('signup: rejects oversized public account fields before persistence', async () => {
    await expect(caller().auth.signup({
      ...newUser,
      email: 'oversized@example.com',
      password: 'p'.repeat(129),
      accountType: 'player',
    })).rejects.toThrow()

    const [{ count }] = await queryClient<{ count: number }[]>`
      SELECT count(*)::int AS count FROM profiles WHERE email = 'oversized@example.com'
    `
    expect(count).toBe(0)
  })

  it('signup: builds verification links from the configured canonical app URL', async () => {
    const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = 'https://staging.example.test/base/'
    try {
      await caller().auth.signup({
        ...newUser,
        email: 'configured-url@example.com',
        accountType: 'player',
      })
      const [email] = await queryClient<{ payload: Record<string, string> }[]>`
        SELECT payload FROM email_logs WHERE "to" = 'configured-url@example.com'
      `
      const actionUrl = decryptActionUrl(
        email.payload.actionUrlEncrypted,
        process.env.JWT_SECRET!,
      )
      expect(actionUrl).toMatch(/^https:\/\/staging\.example\.test\/base\/verify-email\?token=/)
    } finally {
      if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
      else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl
    }
  })

  it('verifyEmail: consumes the token, verifies the account, and queues welcome once', async () => {
    await caller().auth.signup({
      ...newUser,
      email: 'verify@example.com',
      accountType: 'player',
    })
    const [verificationEmail] = await queryClient<{ payload: Record<string, string> }[]>`
      SELECT payload FROM email_logs WHERE template = 'verify_email' AND "to" = 'verify@example.com'
    `
    const actionUrl = decryptActionUrl(
      verificationEmail.payload.actionUrlEncrypted,
      process.env.JWT_SECRET!,
    )
    const token = new URL(actionUrl).searchParams.get('token')
    expect(token).toBeTruthy()

    await expect(caller().auth.verifyEmail({ token: token! })).resolves.toEqual({ verified: true })
    await expect(caller().auth.verifyEmail({ token: token! })).resolves.toEqual({ verified: true })

    const [credential] = await queryClient<{ emailVerifiedAt: string | null }[]>`
      SELECT "emailVerifiedAt" FROM user_credentials WHERE email = 'verify@example.com'
    `
    const [storedToken] = await queryClient<{ usedAt: string | null }[]>`
      SELECT "usedAt" FROM auth_tokens WHERE "tokenHash" IS NOT NULL
    `
    const [{ welcomeCount }] = await queryClient<{ welcomeCount: number }[]>`
      SELECT count(*)::int AS "welcomeCount" FROM email_logs WHERE template = 'welcome'
    `

    expect(credential.emailVerifiedAt).toBeTruthy()
    expect(storedToken.usedAt).toBeTruthy()
    expect(welcomeCount).toBe(1)
  })

  it('signup: creates an unverified organizer profile and credentials without a session', async () => {
    const result = await caller().auth.signup(newUser)
    expect(result).toEqual({ requiresVerification: true })

    const [saved] = await db
      .select()
      .from(allSchema.profiles)
      .where(eq(allSchema.profiles.email, newUser.email))
    expect(saved).toMatchObject({
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      role: 'organizer',
    })

    const [cred] = await db
      .select()
      .from(allSchema.userCredentials)
      .where(eq(allSchema.userCredentials.email, newUser.email))
    expect(cred).toMatchObject({ profileId: saved!.id, emailVerifiedAt: null })

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
      .where(eq(allSchema.profiles.id, saved!.id))

    expect(provisioning).toMatchObject({
      profileRole: 'organizer',
      membershipRole: 'owner',
      organizationName: 'Test User Organization',
    })

    const [verificationEmail] = await db
      .select()
      .from(allSchema.emailLogs)
      .where(eq(allSchema.emailLogs.template, 'verify_email'))
    expect(verificationEmail).toMatchObject({
      profileId: saved!.id,
      to: newUser.email,
      template: 'verify_email',
      status: 'pending',
    })
  })

  it('signup: creates a player without provisioning an organization', async () => {
    await caller().auth.signup({
      ...newUser,
      email: 'player@example.com',
      accountType: 'player',
    })

    const [profile] = await db
      .select()
      .from(allSchema.profiles)
      .where(eq(allSchema.profiles.email, 'player@example.com'))
    expect(profile).toMatchObject({
      email: 'player@example.com',
      role: 'player',
    })

    const memberships = await db
      .select()
      .from(allSchema.organizationMembers)
      .where(eq(allSchema.organizationMembers.profileId, profile!.id))

    expect(memberships).toHaveLength(0)
  })

  it('signup: duplicate responses are generic and only unverified accounts receive a replacement link', async () => {
    const first = await caller().auth.signup({
      ...newUser,
      email: 'duplicate@example.com',
      accountType: 'player',
    })
    const duplicate = await caller().auth.signup({
      ...newUser,
      email: 'DUPLICATE@example.com',
      accountType: 'player',
    })

    expect(duplicate).toEqual(first)
    const [{ profileCount }] = await queryClient<{ profileCount: number }[]>`
      SELECT count(*)::int AS "profileCount" FROM profiles WHERE email = 'duplicate@example.com'
    `
    const verificationEmails = await queryClient<{ payload: Record<string, string> }[]>`
      SELECT payload FROM email_logs
      WHERE template = 'verify_email' AND "to" = 'duplicate@example.com'
      ORDER BY "createdAt" ASC
    `
    const [{ unusedTokens }] = await queryClient<{ unusedTokens: number }[]>`
      SELECT count(*)::int AS "unusedTokens" FROM auth_tokens
      WHERE type = 'email_verification' AND "usedAt" IS NULL
    `
    expect(profileCount).toBe(1)
    expect(verificationEmails).toHaveLength(2)
    expect(unusedTokens).toBe(1)

    const latestUrl = decryptActionUrl(
      verificationEmails.at(-1)!.payload.actionUrlEncrypted,
      process.env.JWT_SECRET!,
    )
    await caller().auth.verifyEmail({ token: new URL(latestUrl).searchParams.get('token')! })
    await expect(caller().auth.signup({
      ...newUser,
      email: 'duplicate@example.com',
      accountType: 'player',
    })).resolves.toEqual(first)

    const [{ finalEmailCount }] = await queryClient<{ finalEmailCount: number }[]>`
      SELECT count(*)::int AS "finalEmailCount" FROM email_logs
      WHERE template = 'verify_email' AND "to" = 'duplicate@example.com'
    `
    expect(finalEmailCount).toBe(2)
  })

  it('signup: concurrent duplicate requests resolve generically and create one account', async () => {
    const input = {
      ...newUser,
      email: 'concurrent@example.com',
      accountType: 'player' as const,
    }
    const results = await Promise.all([
      caller(undefined, '203.0.113.101').auth.signup(input),
      caller(undefined, '203.0.113.102').auth.signup(input),
    ])
    expect(results).toEqual([
      { requiresVerification: true },
      { requiresVerification: true },
    ])

    const [{ profileCount }] = await queryClient<{ profileCount: number }[]>`
      SELECT count(*)::int AS "profileCount" FROM profiles WHERE email = 'concurrent@example.com'
    `
    const [{ unusedTokenCount }] = await queryClient<{ unusedTokenCount: number }[]>`
      SELECT count(*)::int AS "unusedTokenCount"
      FROM auth_tokens token
      INNER JOIN profiles profile ON profile.id = token."profileId"
      WHERE profile.email = 'concurrent@example.com'
        AND token.type = 'email_verification'
        AND token."usedAt" IS NULL
    `
    expect(profileCount).toBe(1)
    expect(unusedTokenCount).toBe(1)
  })

  it('signup: blocks the fourth request for the same IP and normalized email', async () => {
    const c = caller(undefined, '203.0.113.81')
    const input = {
      ...newUser,
      email: 'limited-signup@example.com',
      accountType: 'player' as const,
    }
    await expect(c.auth.signup(input)).resolves.toEqual({ requiresVerification: true })
    await expect(c.auth.signup({ ...input, email: 'LIMITED-SIGNUP@example.com' }))
      .resolves.toEqual({ requiresVerification: true })
    await expect(c.auth.signup(input)).resolves.toEqual({ requiresVerification: true })
    await expect(c.auth.signup(input)).rejects.toThrow(/too many attempts/i)
  })

  it('resendVerification: returns a generic response and queues only for an unverified account', async () => {
    await caller().auth.signup({
      ...newUser,
      email: 'resend@example.com',
      accountType: 'player',
    })
    const generic = { message: 'If verification is pending, a new email has been queued.' }

    await expect(caller().auth.resendVerification({ email: 'RESEND@example.com' }))
      .resolves.toEqual(generic)
    await expect(caller().auth.resendVerification({ email: 'missing@example.com' }))
      .resolves.toEqual(generic)

    const [{ count }] = await queryClient<{ count: number }[]>`
      SELECT count(*)::int AS count FROM email_logs
      WHERE template = 'verify_email' AND "to" = 'resend@example.com'
    `
    expect(count).toBe(2)
  })

  it('resendVerification: limits the fourth request for the same IP and email', async () => {
    const c = caller(undefined, '203.0.113.93')
    const email = 'resend-limited@example.com'
    await c.auth.signup({ ...newUser, email, accountType: 'player' })
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(c.auth.resendVerification({ email })).resolves.toHaveProperty('message')
    }
    await expect(c.auth.resendVerification({ email })).rejects.toThrow(/too many attempts/i)
  })

  it('signup: provisioned organizer creates a tournament without an organization header', async () => {
    const { profile } = await signupVerifyAndLogin(newUser)
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

  it('login: rejects correct credentials until the email is verified', async () => {
    await caller().auth.signup({
      ...newUser,
      email: 'unverified@example.com',
      accountType: 'player',
    })

    await expect(caller().auth.login({
      email: 'UNVERIFIED@example.com',
      password: newUser.password,
    })).rejects.toThrow(/verify your email/i)
  })

  it('login: correct credentials returns token and profile', async () => {
    const result = await signupVerifyAndLogin(newUser)

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

  it('login: blocks the sixth attempt for the same IP and normalized email', async () => {
    const c = caller(undefined, '203.0.113.44')
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(c.auth.login({
        email: 'MISSING@example.com',
        password: 'incorrect-password',
      })).rejects.toThrow(/invalid email or password/i)
    }

    await expect(c.auth.login({
      email: 'missing@example.com',
      password: 'incorrect-password',
    })).rejects.toThrow(/too many attempts/i)
  })

  it('login: blocks password spraying across different emails from one IP', async () => {
    const c = caller(undefined, '203.0.113.45')
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await expect(c.auth.login({
        email: `missing-${attempt}@example.com`,
        password: 'incorrect-password',
      })).rejects.toThrow(/invalid email or password/i)
    }

    await expect(c.auth.login({
      email: 'missing-final@example.com',
      password: 'incorrect-password',
    })).rejects.toThrow(/too many attempts/i)
  })

  it('context: rejects a signed JWT after the credential auth version changes', async () => {
    await caller().auth.signup({
      ...newUser,
      email: 'versioned@example.com',
      accountType: 'player',
    })
    const [verificationEmail] = await queryClient<{ payload: Record<string, string> }[]>`
      SELECT payload FROM email_logs WHERE template = 'verify_email' AND "to" = 'versioned@example.com'
    `
    const verificationUrl = decryptActionUrl(
      verificationEmail.payload.actionUrlEncrypted,
      process.env.JWT_SECRET!,
    )
    await caller().auth.verifyEmail({
      token: new URL(verificationUrl).searchParams.get('token')!,
    })
    const login = await caller().auth.login({
      email: 'versioned@example.com',
      password: newUser.password,
    })

    const request = {
      headers: { authorization: `Bearer ${login.token}` },
    }
    const validContext = await createContext({ req: request as never, res: {} as never })
    expect(validContext.userId).toBe(login.profile.id)

    await queryClient`
      UPDATE user_credentials SET "authVersion" = "authVersion" + 1
      WHERE "profileId" = ${login.profile.id}
    `
    const revokedContext = await createContext({ req: request as never, res: {} as never })
    expect(revokedContext.userId).toBeNull()
  })

  it('password recovery: is generic, single-use, changes the password, and revokes old JWTs', async () => {
    await caller().auth.signup({
      ...newUser,
      email: 'recover@example.com',
      accountType: 'player',
    })
    const [verificationEmail] = await queryClient<{ payload: Record<string, string> }[]>`
      SELECT payload FROM email_logs WHERE template = 'verify_email' AND "to" = 'recover@example.com'
    `
    const verificationUrl = decryptActionUrl(
      verificationEmail.payload.actionUrlEncrypted,
      process.env.JWT_SECRET!,
    )
    await caller().auth.verifyEmail({
      token: new URL(verificationUrl).searchParams.get('token')!,
    })
    const oldLogin = await caller().auth.login({
      email: 'recover@example.com',
      password: newUser.password,
    })

    const generic = { message: 'If an account exists, a recovery email has been queued.' }
    await expect(caller().auth.forgotPassword({ email: 'RECOVER@example.com' })).resolves.toEqual(generic)
    await expect(caller().auth.forgotPassword({ email: 'missing@example.com' })).resolves.toEqual(generic)

    const [resetEmail] = await queryClient<{ payload: Record<string, string> }[]>`
      SELECT payload FROM email_logs WHERE template = 'password_reset' AND "to" = 'recover@example.com'
    `
    const resetUrl = decryptActionUrl(resetEmail.payload.actionUrlEncrypted, process.env.JWT_SECRET!)
    const resetToken = new URL(resetUrl).searchParams.get('token')!
    const newPassword = 'a-new-secure-password'

    await expect(caller().auth.resetPassword({
      token: resetToken,
      password: newPassword,
    })).resolves.toEqual({ reset: true })
    await expect(caller().auth.resetPassword({
      token: resetToken,
      password: 'another-secure-password',
    })).rejects.toThrow(/invalid or expired/i)
    await expect(caller().auth.login({
      email: 'recover@example.com',
      password: newUser.password,
    })).rejects.toThrow(/invalid email or password/i)
    await expect(caller().auth.login({
      email: 'recover@example.com',
      password: newPassword,
    })).resolves.toHaveProperty('token')

    const revokedContext = await createContext({
      req: { headers: { authorization: `Bearer ${oldLogin.token}` } } as never,
      res: {} as never,
    })
    expect(revokedContext.userId).toBeNull()
  })

  it('forgotPassword: rate limits missing and existing emails identically', async () => {
    const c = caller(undefined, '203.0.113.92')
    const input = { email: 'unknown-rate-limit@example.com' }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(c.auth.forgotPassword(input)).resolves.toHaveProperty('message')
    }
    await expect(c.auth.forgotPassword(input)).rejects.toThrow(/too many attempts/i)
  })

  it('verify and reset token submissions are rate limited by IP', async () => {
    const verificationCaller = caller(undefined, '203.0.113.94')
    const invalidToken = 'v'.repeat(43)
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(verificationCaller.auth.verifyEmail({ token: invalidToken }))
        .rejects.toThrow(/invalid or expired/i)
    }
    await expect(verificationCaller.auth.verifyEmail({ token: invalidToken }))
      .rejects.toThrow(/too many attempts/i)

    const resetCaller = caller(undefined, '203.0.113.95')
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(resetCaller.auth.resetPassword({
        token: 'r'.repeat(43),
        password: 'secure-password-123',
      })).rejects.toThrow(/invalid or expired/i)
    }
    await expect(resetCaller.auth.resetPassword({
      token: 'r'.repeat(43),
      password: 'secure-password-123',
    })).rejects.toThrow(/too many attempts/i)
  })

  it('me: valid token returns profile', async () => {
    const { profile } = await signupVerifyAndLogin(newUser)

    // Create an authenticated caller with the profile id (simulating validated JWT auth)
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
