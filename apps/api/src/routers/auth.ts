import { z } from 'zod'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { router, procedure } from '../trpc'
import {
  authTokens,
  organizationMembers,
  organizations,
  profiles,
  userCredentials,
} from '@bowling/db'
import { TRPCError } from '@trpc/server'
import { queueEmail, type QueueEmailParams } from '../services/email'
import {
  clearRateLimit,
  consumeRateLimit,
  createAuthToken,
  encryptActionUrl,
  hashAuthToken,
  RateLimitExceededError,
} from '../services/account-security'

const SALT_ROUNDS = 10
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomUUID(), SALT_ROUNDS)
const GENERIC_SIGNUP_RESULT = { requiresVerification: true as const }

function getPublicAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bolos.mogambo.xyz'
  const url = new URL(configured)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('NEXT_PUBLIC_APP_URL must be an HTTP(S) URL without credentials')
  }
  return configured.replace(/\/+$/, '')
}

function isEmailUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    const candidate = current as {
      code?: string
      constraint_name?: string
      cause?: unknown
    }
    if (
      candidate.code === '23505'
      && ['profiles_email_unique', 'user_credentials_email_unique'].includes(
        candidate.constraint_name ?? '',
      )
    ) return true
    current = candidate.cause
  }
  return false
}

async function queueVerificationEmail(
  db: QueueEmailParams['db'],
  account: { id: string; email: string; firstName: string },
) {
  const now = new Date()
  const rawToken = createAuthToken()
  const tokenHash = hashAuthToken(rawToken)
  const verificationUrl = `${getPublicAppUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`

  await db
    .update(authTokens)
    .set({ usedAt: now, updatedAt: now })
    .where(and(
      eq(authTokens.profileId, account.id),
      eq(authTokens.type, 'email_verification'),
      isNull(authTokens.usedAt),
    ))
  await db.insert(authTokens).values({
    profileId: account.id,
    tokenHash,
    type: 'email_verification',
    expiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
  })
  await queueEmail({
    db,
    profileId: account.id,
    to: account.email,
    idempotencyKey: `verify-email:${account.id}:${tokenHash}`,
    template: 'verify_email',
    data: {
      firstName: account.firstName,
      actionUrlEncrypted: encryptActionUrl(verificationUrl, getJwtSecret()),
    },
  })
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return secret
}

async function enforceAuthRateLimit(input: {
  db: QueueEmailParams['db']
  ip: string
  action: string
  email?: string
  limit: number
  windowMs: number
}) {
  const rateLimitInput = {
    db: input.db,
    secret: getJwtSecret(),
    action: input.action,
    identifiers: [input.ip || 'unknown', input.email ?? ''],
    limit: input.limit,
    windowMs: input.windowMs,
  }
  try {
    await consumeRateLimit(rateLimitInput)
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many attempts. Please try again later.',
        cause: error,
      })
    }
    throw error
  }
  return rateLimitInput
}

export function signToken(
  profileId: string,
  authVersion = 0,
  secret = getJwtSecret(),
): string {
  return jwt.sign({ sub: profileId, v: authVersion }, secret, { expiresIn: '7d' })
}

export function verifyToken(token: string): { profileId: string; authVersion: number } | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { sub: string; v?: number }
    return { profileId: payload.sub, authVersion: payload.v ?? 0 }
  } catch {
    return null
  }
}

export const authRouter = router({
  signup: procedure
    .input(z.object({
      email: z.string().trim().toLowerCase().email().max(320),
      password: z.string().min(8).max(128),
      firstName: z.string().trim().min(1).max(100),
      lastName: z.string().trim().min(1).max(100),
      accountType: z.enum(['organizer', 'player']).default('organizer'),
    }))
    .mutation(async ({ ctx, input }) => {
      const normalizedEmail = input.email.trim().toLowerCase()
      await enforceAuthRateLimit({
        db: ctx.db,
        ip: ctx.ip,
        action: 'signup_ip',
        limit: 10,
        windowMs: 60 * 60_000,
      })
      await enforceAuthRateLimit({
        db: ctx.db,
        ip: ctx.ip,
        action: 'signup_email',
        email: normalizedEmail,
        limit: 3,
        windowMs: 60 * 60_000,
      })
      const [existing] = await ctx.db
        .select({
          profileId: userCredentials.profileId,
          emailVerifiedAt: userCredentials.emailVerifiedAt,
          email: profiles.email,
          firstName: profiles.firstName,
        })
        .from(userCredentials)
        .innerJoin(profiles, eq(profiles.id, userCredentials.profileId))
        .where(eq(userCredentials.email, normalizedEmail))
        .limit(1)

      if (existing) {
        if (!existing.emailVerifiedAt) {
          await ctx.db.transaction((tx) => queueVerificationEmail(tx, {
            id: existing.profileId,
            email: existing.email,
            firstName: existing.firstName,
          }))
        }
        return GENERIC_SIGNUP_RESULT
      }

      const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS)
      const profileId = crypto.randomUUID()
      const organizationId = crypto.randomUUID()
      const organizationName = `${input.firstName} ${input.lastName} Organization`

      try {
        await ctx.db.transaction(async (tx) => {
          const [createdProfile] = await tx
            .insert(profiles)
            .values({
              id: profileId,
              email: normalizedEmail,
              firstName: input.firstName,
              lastName: input.lastName,
              role: input.accountType,
            })
            .returning()

          if (!createdProfile) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create profile' })
          }

          await tx.insert(userCredentials).values({
            profileId,
            email: normalizedEmail,
            passwordHash,
            emailVerifiedAt: null,
          })

          if (input.accountType === 'organizer') {
            await tx.insert(organizations).values({
              id: organizationId,
              name: organizationName,
              slug: `organization-${organizationId}`,
            })

            await tx.insert(organizationMembers).values({
              organizationId,
              profileId,
              role: 'owner',
            })
          }

          await queueVerificationEmail(tx, createdProfile)
        })
      } catch (error) {
        if (!isEmailUniqueViolation(error)) throw error
      }

      return GENERIC_SIGNUP_RESULT
    }),

  verifyEmail: procedure
    .input(z.object({ token: z.string().min(32).max(512) }))
    .mutation(async ({ ctx, input }) => {
      await enforceAuthRateLimit({
        db: ctx.db,
        ip: ctx.ip,
        action: 'verify_email_token',
        limit: 10,
        windowMs: 60 * 60_000,
      })
      const tokenHash = hashAuthToken(input.token)
      const now = new Date()

      return ctx.db.transaction(async (tx) => {
        const consumedResult = await tx.execute(sql`
          UPDATE auth_tokens
          SET "usedAt" = ${now.toISOString()}::timestamptz,
            "updatedAt" = ${now.toISOString()}::timestamptz
          WHERE "tokenHash" = ${tokenHash}
            AND type = 'email_verification'
            AND "usedAt" IS NULL
            AND "expiresAt" > ${now.toISOString()}::timestamptz
          RETURNING "profileId"
        `)
        const [consumed] = Array.from(
          consumedResult as unknown as Iterable<{ profileId: string }>,
        )

        if (!consumed) {
          const [existingToken] = await tx
            .select({ profileId: authTokens.profileId, usedAt: authTokens.usedAt })
            .from(authTokens)
            .where(and(eq(authTokens.tokenHash, tokenHash), eq(authTokens.type, 'email_verification')))
            .limit(1)
          if (existingToken?.usedAt) {
            const [credential] = await tx
              .select({ emailVerifiedAt: userCredentials.emailVerifiedAt })
              .from(userCredentials)
              .where(eq(userCredentials.profileId, existingToken.profileId))
              .limit(1)
            if (credential?.emailVerifiedAt) return { verified: true as const }
          }
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired verification link' })
        }

        const [credential] = await tx
          .update(userCredentials)
          .set({ emailVerifiedAt: now })
          .where(eq(userCredentials.profileId, consumed.profileId))
          .returning()
        if (!credential) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired verification link' })
        }

        await tx
          .update(authTokens)
          .set({ usedAt: now, updatedAt: now })
          .where(and(
            eq(authTokens.profileId, consumed.profileId),
            eq(authTokens.type, 'email_verification'),
            isNull(authTokens.usedAt),
          ))

        const [profile] = await tx
          .select()
          .from(profiles)
          .where(eq(profiles.id, consumed.profileId))
          .limit(1)
        if (!profile) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired verification link' })
        }

        await queueEmail({
          db: tx,
          profileId: profile.id,
          to: profile.email,
          idempotencyKey: `welcome:${profile.id}`,
          template: 'welcome',
          data: { firstName: profile.firstName, role: profile.role },
        })

        return { verified: true as const }
      })
    }),

  resendVerification: procedure
    .input(z.object({ email: z.string().trim().toLowerCase().email().max(320) }))
    .mutation(async ({ ctx, input }) => {
      const generic = {
        message: 'If verification is pending, a new email has been queued.' as const,
      }
      const normalizedEmail = input.email.trim().toLowerCase()
      await enforceAuthRateLimit({
        db: ctx.db,
        ip: ctx.ip,
        action: 'resend_verification',
        email: normalizedEmail,
        limit: 3,
        windowMs: 60 * 60_000,
      })
      const [account] = await ctx.db
        .select({
          profileId: userCredentials.profileId,
          emailVerifiedAt: userCredentials.emailVerifiedAt,
          email: profiles.email,
          firstName: profiles.firstName,
        })
        .from(userCredentials)
        .innerJoin(profiles, eq(profiles.id, userCredentials.profileId))
        .where(eq(userCredentials.email, normalizedEmail))
        .limit(1)

      if (account && !account.emailVerifiedAt) {
        await ctx.db.transaction((tx) => queueVerificationEmail(tx, {
          id: account.profileId,
          email: account.email,
          firstName: account.firstName,
        }))
      }

      return generic
    }),

  forgotPassword: procedure
    .input(z.object({ email: z.string().trim().toLowerCase().email().max(320) }))
    .mutation(async ({ ctx, input }) => {
      const generic = { message: 'If an account exists, a recovery email has been queued.' as const }
      const normalizedEmail = input.email.trim().toLowerCase()
      await enforceAuthRateLimit({
        db: ctx.db,
        ip: ctx.ip,
        action: 'forgot_password_ip',
        limit: 20,
        windowMs: 60 * 60_000,
      })
      await enforceAuthRateLimit({
        db: ctx.db,
        ip: ctx.ip,
        action: 'forgot_password_email',
        email: normalizedEmail,
        limit: 3,
        windowMs: 60 * 60_000,
      })
      const [account] = await ctx.db
        .select({
          profileId: userCredentials.profileId,
          emailVerifiedAt: userCredentials.emailVerifiedAt,
          firstName: profiles.firstName,
          email: profiles.email,
        })
        .from(userCredentials)
        .innerJoin(profiles, eq(profiles.id, userCredentials.profileId))
        .where(eq(userCredentials.email, normalizedEmail))
        .limit(1)

      if (!account?.emailVerifiedAt) return generic

      const rawToken = createAuthToken()
      const tokenHash = hashAuthToken(rawToken)
      const resetUrl = `${getPublicAppUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`
      const now = new Date()
      await ctx.db.transaction(async (tx) => {
        await tx
          .update(authTokens)
          .set({ usedAt: now, updatedAt: now })
          .where(and(
            eq(authTokens.profileId, account.profileId),
            eq(authTokens.type, 'password_reset'),
            isNull(authTokens.usedAt),
          ))
        await tx.insert(authTokens).values({
          profileId: account.profileId,
          tokenHash,
          type: 'password_reset',
          expiresAt: new Date(now.getTime() + 60 * 60_000),
        })
        await queueEmail({
          db: tx,
          profileId: account.profileId,
          to: account.email,
          idempotencyKey: `password-reset:${account.profileId}:${tokenHash}`,
          template: 'password_reset',
          data: {
            firstName: account.firstName,
            actionUrlEncrypted: encryptActionUrl(resetUrl, getJwtSecret()),
          },
        })
      })

      return generic
    }),

  resetPassword: procedure
    .input(z.object({
      token: z.string().min(32).max(512),
      password: z.string().min(8).max(128),
    }))
    .mutation(async ({ ctx, input }) => {
      await enforceAuthRateLimit({
        db: ctx.db,
        ip: ctx.ip,
        action: 'reset_password_token',
        limit: 5,
        windowMs: 60 * 60_000,
      })
      const tokenHash = hashAuthToken(input.token)
      const now = new Date()
      const [candidate] = await ctx.db
        .select({ id: authTokens.id })
        .from(authTokens)
        .where(and(
          eq(authTokens.tokenHash, tokenHash),
          eq(authTokens.type, 'password_reset'),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, now),
        ))
        .limit(1)
      if (!candidate) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired reset link' })
      }
      const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS)

      return ctx.db.transaction(async (tx) => {
        const consumedResult = await tx.execute(sql`
          UPDATE auth_tokens
          SET "usedAt" = ${now.toISOString()}::timestamptz,
            "updatedAt" = ${now.toISOString()}::timestamptz
          WHERE "tokenHash" = ${tokenHash}
            AND type = 'password_reset'
            AND "usedAt" IS NULL
            AND "expiresAt" > ${now.toISOString()}::timestamptz
          RETURNING "profileId"
        `)
        const [consumed] = Array.from(
          consumedResult as unknown as Iterable<{ profileId: string }>,
        )
        if (!consumed) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired reset link' })
        }

        const [credential] = await tx
          .update(userCredentials)
          .set({
            passwordHash,
            authVersion: sql`${userCredentials.authVersion} + 1`,
            updatedAt: now,
          })
          .where(eq(userCredentials.profileId, consumed.profileId))
          .returning({ profileId: userCredentials.profileId })
        if (!credential) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired reset link' })
        }

        await tx
          .update(authTokens)
          .set({ usedAt: now, updatedAt: now })
          .where(and(
            eq(authTokens.profileId, consumed.profileId),
            eq(authTokens.type, 'password_reset'),
            isNull(authTokens.usedAt),
          ))

        return { reset: true as const }
      })
    }),

  login: procedure
    .input(z.object({
      email: z.string().trim().toLowerCase().email().max(320),
      password: z.string().min(1).max(128),
    }))
    .mutation(async ({ ctx, input }) => {
      const normalizedEmail = input.email.trim().toLowerCase()
      await enforceAuthRateLimit({
        db: ctx.db,
        ip: ctx.ip,
        action: 'login_ip',
        limit: 30,
        windowMs: 15 * 60_000,
      })
      const rateLimit = await enforceAuthRateLimit({
        db: ctx.db,
        ip: ctx.ip,
        action: 'login',
        email: normalizedEmail,
        limit: 5,
        windowMs: 15 * 60_000,
      })
      const [cred] = await ctx.db
        .select()
        .from(userCredentials)
        .where(eq(userCredentials.email, normalizedEmail))
        .limit(1)

      const valid = await bcrypt.compare(input.password, cred?.passwordHash ?? DUMMY_PASSWORD_HASH)
      if (!cred || !valid) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' })
      }

      if (!cred.emailVerifiedAt) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Please verify your email before signing in' })
      }

      const [profile] = await ctx.db
        .select()
        .from(profiles)
        .where(eq(profiles.id, cred.profileId))
        .limit(1)

      if (!profile) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Profile not found' })
      }

      await clearRateLimit(rateLimit)
      const token = signToken(profile.id, cred.authVersion)

      return {
        token,
        profile: {
          id: profile.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          role: profile.role,
        },
      }
    }),

  me: procedure
    .query(async ({ ctx }) => {
      if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' })
      }

      const [profile] = await ctx.db
        .select()
        .from(profiles)
        .where(eq(profiles.id, ctx.userId))
        .limit(1)

      if (!profile) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Profile not found' })
      }

      // Lookup organization membership for organizers
      let organizationId: string | null = null
      let organizationName: string | null = null
      const [member] = await ctx.db
        .select({ organizationId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(eq(organizationMembers.profileId, ctx.userId))
        .limit(1)
      
      if (member) {
        organizationId = member.organizationId
        const [org] = await ctx.db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, member.organizationId))
          .limit(1)
        if (org) organizationName = org.name
      }

      return { ...profile, organizationId, organizationName }
    }),
})
