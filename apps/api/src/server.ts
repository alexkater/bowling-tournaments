import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import { appRouter } from './routers'
import { createContext } from './context'
import { wsManager } from './ws/manager'
import { db } from './db'
import { startEmailOutboxWorker } from './services/email'

const server = Fastify({ logger: true })

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
