import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import { appRouter } from './routers'
import { createContext } from './context'
import { wsManager } from './ws/manager'
import { db } from './db'
import { startEmailOutboxWorker } from './services/email'
import { tournamentDocuments } from '@bowling/db'
import { eq } from 'drizzle-orm'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const server = Fastify({ logger: true, trustProxy: 1 })

async function bootstrap() {
  await server.register(cors, { origin: true })
  await server.register(websocket)

  await server.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
    },
  })

  server.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // Document download route (public, no auth required)
  server.get('/api/documents/:documentId/download', async (request, reply) => {
    const { documentId } = request.params as { documentId: string }

    const [doc] = await db
      .select()
      .from(tournamentDocuments)
      .where(eq(tournamentDocuments.id, documentId))
      .limit(1)

    if (!doc) {
      return reply.code(404).send({ error: 'Document not found' })
    }

    const uploadsDir = process.env.UPLOADS_DIR ?? '/tmp/bowling-uploads'
    const ext = path.extname(doc.fileName) || ''
    const filePath = path.join(uploadsDir, doc.tournamentId, `${doc.id}${ext}`)

    if (!existsSync(filePath)) {
      return reply.code(404).send({ error: 'File not found on disk' })
    }

    return reply
      .header('Content-Type', doc.mimeType)
      .header('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`)
      .send(readFileSync(filePath))
  })

  server.register(async function wsRoutes(fastify) {
    fastify.get('/ws/standings/:squadId', { websocket: true }, (socket, req) => {
      const { squadId } = req.params as { squadId: string }
      wsManager.add(squadId, socket)
    })
  })

  const heartbeat = wsManager.startHeartbeat(30_000)
  const stopEmailWorker = startEmailOutboxWorker({
    db,
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
    actionLinkSecret: process.env.JWT_SECRET,
    onError: (error) => server.log.error(error, 'Email outbox worker failed'),
  })

  server.addHook('onClose', () => {
    clearInterval(heartbeat)
    stopEmailWorker()
  })

  const port = parseInt(process.env.PORT ?? '3001', 10)
  try {
    await server.listen({ port, host: '0.0.0.0' })
    console.log(`API server running on port ${port}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

bootstrap()
