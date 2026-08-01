import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@bowling/db'
import { appRouter } from '../routers'
import { createNotification } from '../services/notifications'

const queryClient = postgres(
  process.env.DATABASE_URL ?? 'postgres://bowling:bowling@localhost:5432/bowling',
  { max: 1 },
)
const db = drizzle(queryClient, { schema })
const createCaller = (userId: string) => appRouter.createCaller({
  db,
  userId,
  orgId: null,
  req: {} as never,
  res: {} as never,
})

beforeEach(async () => {
  await queryClient`DROP TABLE IF EXISTS pg_temp.notifications`
  await queryClient`
    CREATE TEMP TABLE notifications (
      id text PRIMARY KEY,
      "profileId" text NOT NULL,
      type text NOT NULL,
      title text NOT NULL,
      body text NOT NULL,
      metadata jsonb DEFAULT '{}'::jsonb,
      read boolean NOT NULL DEFAULT false,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `
  await queryClient`
    INSERT INTO notifications (id, "profileId", type, title, body, read, "createdAt") VALUES
      ('n1', 'profile-1', 'system', 'Unread', 'one', false, '2026-08-01T10:00:00Z'),
      ('n2', 'profile-1', 'system', 'Read', 'two', true, '2026-08-01T11:00:00Z'),
      ('n3', 'profile-2', 'system', 'Other user', 'three', false, '2026-08-01T12:00:00Z')
  `
})

afterAll(async () => {
  await queryClient.end()
})

describe('notification router', () => {
  it('propagates persistence failures instead of silently dropping a notification', async () => {
    const failingDb = {
      insert: () => ({ values: async () => { throw new Error('database unavailable') } }),
    }

    await expect(createNotification({
      db: failingDb as never,
      profileId: 'profile-1',
      type: 'system',
      title: 'Important',
      body: 'Message',
    })).rejects.toThrow('database unavailable')
  })

  it('returns only the authenticated profile notifications', async () => {
    const caller = createCaller('profile-1')

    const items = await caller.notification.list({ limit: 20, unreadOnly: false })

    expect(items.map((item) => item.id)).toEqual(['n2', 'n1'])
  })

  it('filters read notifications when unreadOnly is true', async () => {
    const caller = createCaller('profile-1')

    const items = await caller.notification.list({ limit: 20, unreadOnly: true })

    expect(items.map((item) => item.id)).toEqual(['n1'])
  })

  it('rejects unbounded notification list requests', async () => {
    await expect(
      createCaller('profile-1').notification.list({ limit: 101, unreadOnly: false }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})
