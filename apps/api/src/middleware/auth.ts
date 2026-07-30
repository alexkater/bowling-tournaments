import { TRPCError } from '@trpc/server'
import { eq, and } from 'drizzle-orm'
import { middleware } from '../trpc'
import { organizationMembers } from '@bowling/db'

export const requireAuth = middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    })
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  })
})

export const requireOrgAccess = middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' })
  }

  const memberships = await ctx.db
    .select({
      id: organizationMembers.id,
      organizationId: organizationMembers.organizationId,
    })
    .from(organizationMembers)
    .where(
      ctx.orgId
        ? and(
            eq(organizationMembers.organizationId, ctx.orgId),
            eq(organizationMembers.profileId, ctx.userId),
          )
        : eq(organizationMembers.profileId, ctx.userId),
    )
    .limit(ctx.orgId ? 1 : 2)

  if (memberships.length === 0) {
    if (!ctx.orgId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No organization context' })
    }
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not belong to this organization',
    })
  }

  if (!ctx.orgId && memberships.length > 1) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Organization context is required for users with multiple memberships',
    })
  }

  const membership = memberships[0]
  if (!membership) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No organization context' })
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      orgId: membership.organizationId,
    },
  })
})

export const requireOrgRole = (roles: string[]) =>
  middleware(async ({ ctx, next }) => {
    if (!ctx.userId || !ctx.orgId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }

    const [membership] = await ctx.db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, ctx.orgId),
          eq(organizationMembers.profileId, ctx.userId),
        ),
      )
      .limit(1)

    if (!membership) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this organization' })
    }

    if (!roles.includes(membership.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Insufficient permissions. Required role: ${roles.join(' or ')}`,
      })
    }

    return next({
      ctx: {
        ...ctx,
        userId: ctx.userId,
        orgId: ctx.orgId,
      },
    })
  })
