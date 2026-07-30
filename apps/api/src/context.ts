import type { inferAsyncReturnType } from '@trpc/server'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { db } from './db'
import { verifyToken } from './routers/auth'

export async function createContext({ req, res }: { req: FastifyRequest; res: FastifyReply }) {
  let userId: string | null = null
  let orgId: string | null = null

  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const payload = verifyToken(token)
    if (payload) {
      userId = payload.profileId
    }
  }

  orgId = req.headers['x-org-id'] as string | null

  return {
    req,
    res,
    db,
    userId,
    orgId,
  }
}

export type Context = inferAsyncReturnType<typeof createContext>
