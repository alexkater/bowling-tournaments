import { z } from 'zod'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { router, procedure } from '../trpc'
import { organizationMembers, organizations, profiles, userCredentials } from '@bowling/db'
import { TRPCError } from '@trpc/server'

const SALT_ROUNDS = 10

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return secret
}

export function signToken(profileId: string, secret = getJwtSecret()): string {
  return jwt.sign({ sub: profileId }, secret, { expiresIn: '7d' })
}

export function verifyToken(token: string): { profileId: string } | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { sub: string }
    return { profileId: payload.sub }
  } catch {
    return null
  }
}

export const authRouter = router({
  signup: procedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      accountType: z.enum(['organizer', 'player']).default('organizer'),
    }))
    .mutation(async ({ ctx, input }) => {
      const jwtSecret = getJwtSecret()
      const existing = await ctx.db
        .select({ id: userCredentials.id })
        .from(userCredentials)
        .where(eq(userCredentials.email, input.email))
        .limit(1)

      if (existing.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Email already registered' })
      }

      const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS)
      const profileId = crypto.randomUUID()
      const organizationId = crypto.randomUUID()
      const organizationName = `${input.firstName} ${input.lastName} Organization`

      const profile = await ctx.db.transaction(async (tx) => {
        const [createdProfile] = await tx
          .insert(profiles)
          .values({
            id: profileId,
            email: input.email,
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
          email: input.email,
          passwordHash,
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

        return createdProfile
      })

      const token = signToken(profile.id, jwtSecret)

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

  login: procedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const [cred] = await ctx.db
        .select()
        .from(userCredentials)
        .where(eq(userCredentials.email, input.email))
        .limit(1)

      if (!cred) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' })
      }

      const valid = await bcrypt.compare(input.password, cred.passwordHash)
      if (!valid) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' })
      }

      const [profile] = await ctx.db
        .select()
        .from(profiles)
        .where(eq(profiles.id, cred.profileId))
        .limit(1)

      if (!profile) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Profile not found' })
      }

      const token = signToken(profile.id)

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

      return profile
    }),
})
