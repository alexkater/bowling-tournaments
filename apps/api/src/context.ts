import type { inferAsyncReturnType } from '@trpc/server'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { db } from './db'
import { verifyToken } from './routers/auth'
import { userCredentials } from '@bowling/db'
import { eq } from 'drizzle-orm'

export async function createContext({ req, res }: { req: FastifyRequest; res: FastifyReply }) {
  let userId: string | null = null
  let orgId: string | null = null

  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const payload = verifyToken(token)
    if (payload) {
      const [credential] = await db
        .select({
          authVersion: userCredentials.authVersion,
          emailVerifiedAt: userCredentials.emailVerifiedAt,
        })
        .from(userCredentials)
        .where(eq(userCredentials.profileId, payload.profileId))
        .limit(1)
      if (
        credential?.emailVerifiedAt
        && credential.authVersion === payload.authVersion
      ) {
        userId = payload.profileId
      }
    }
  }

  orgId = req.headers['x-org-id'] as string | null

  return {
    req,
    res,
    db,
    userId,
    orgId,
    ip: req.ip,
  }
}

export type Context = inferAsyncReturnType<typeof createContext>
