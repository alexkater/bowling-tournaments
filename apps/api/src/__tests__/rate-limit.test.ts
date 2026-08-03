import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@bowling/db'
import {
  clearRateLimit,
  consumeRateLimit,
  RateLimitExceededError,
} from '../services/account-security'

const queryClient = postgres(
  process.env.DATABASE_URL ?? 'postgres://bowling:bowling_dev@localhost:5432/bowling',
  { max: 1 },
)
const db = drizzle(queryClient, { schema })

beforeEach(async () => {
  await queryClient`DROP TABLE IF EXISTS pg_temp.auth_rate_limits`
  await queryClient`
    CREATE TEMP TABLE auth_rate_limits (
      key text PRIMARY KEY,
      action text NOT NULL,
      count integer NOT NULL,
      "windowStartedAt" timestamptz NOT NULL,
      "expiresAt" timestamptz NOT NULL,
      "updatedAt" timestamptz NOT NULL
    )
  `
})

afterAll(async () => {
  await queryClient.end()
})

describe('persistent auth rate limits', () => {
  it('atomically blocks attempts above the limit without storing raw identifiers', async () => {
    const input = {
      db,
      secret: 'test-only-rate-limit-secret',
      action: 'login',
      identifiers: ['203.0.113.9', 'Player@Example.com'],
      limit: 2,
      windowMs: 60_000,
      now: new Date('2026-08-03T12:00:00Z'),
    }

    await expect(consumeRateLimit(input)).resolves.toMatchObject({ count: 1, remaining: 1 })
    await expect(consumeRateLimit(input)).resolves.toMatchObject({ count: 2, remaining: 0 })
    await expect(consumeRateLimit(input)).rejects.toBeInstanceOf(RateLimitExceededError)

    const [stored] = await queryClient<{ key: string; action: string }[]>`
      SELECT key, action FROM auth_rate_limits
    `
    expect(stored.key).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(stored)).not.toContain('203.0.113.9')
    expect(JSON.stringify(stored).toLowerCase()).not.toContain('player@example.com')
  })

  it('purges stale limiter rows while consuming a new attempt', async () => {
    await queryClient`
      INSERT INTO auth_rate_limits (key, action, count, "windowStartedAt", "expiresAt", "updatedAt")
      VALUES (
        'stale-key', 'stale', 1,
        '2026-01-01T00:00:00Z', '2026-01-01T01:00:00Z', '2026-01-01T00:00:00Z'
      )
    `
    await consumeRateLimit({
      db,
      secret: 'test-rate-limit-secret',
      action: 'login',
      identifiers: ['203.0.113.8', 'fresh@example.com'],
      limit: 5,
      windowMs: 60_000,
      now: new Date('2026-08-03T00:00:00Z'),
    })

    const [{ staleCount }] = await queryClient<{ staleCount: number }[]>`
      SELECT count(*)::int AS "staleCount" FROM auth_rate_limits WHERE key = 'stale-key'
    `
    expect(staleCount).toBe(0)
  })

  it('clears a window after a successful authentication', async () => {
    const input = {
      db,
      secret: 'test-only-rate-limit-secret',
      action: 'login',
      identifiers: ['203.0.113.9', 'player@example.com'],
      limit: 2,
      windowMs: 60_000,
      now: new Date('2026-08-03T12:00:00Z'),
    }

    await consumeRateLimit(input)
    await consumeRateLimit(input)
    await clearRateLimit(input)
    await expect(consumeRateLimit(input)).resolves.toMatchObject({ count: 1, remaining: 1 })
  })
})
