import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@bowling/db'
import { processEmailOutboxBatch, queueEmail } from '../services/email'

const queryClient = postgres(
  process.env.DATABASE_URL ?? 'postgres://bowling:bowling@localhost:5432/bowling',
  { max: 1 },
)
const db = drizzle(queryClient, { schema })

beforeEach(async () => {
  await queryClient`DROP TABLE IF EXISTS pg_temp.email_logs`
  await queryClient`
    CREATE TEMP TABLE email_logs (
      id text PRIMARY KEY,
      "idempotencyKey" text NOT NULL UNIQUE,
      "profileId" text,
      "to" text NOT NULL,
      template text NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      status text NOT NULL DEFAULT 'pending',
      attempts integer NOT NULL DEFAULT 0,
      "maxAttempts" integer NOT NULL DEFAULT 5,
      "nextAttemptAt" timestamptz NOT NULL DEFAULT now(),
      "lockedAt" timestamptz,
      "providerMessageId" text,
      error text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "sentAt" timestamptz
    )
  `
})

afterAll(async () => {
  await queryClient.end()
})

describe('email outbox', () => {
  it('enqueues only one row for the same idempotency key', async () => {
    const input = {
      db,
      idempotencyKey: 'welcome:profile-1',
      profileId: 'profile-1',
      to: 'player@example.test',
      template: 'welcome' as const,
      data: { firstName: 'Player', role: 'player' },
    }

    const first = await queueEmail(input)
    const second = await queueEmail(input)
    const [{ count }] = await queryClient<{ count: number }[]>`
      SELECT count(*)::int AS count FROM email_logs
    `

    expect(count).toBe(1)
    expect(second.id).toBe(first.id)
    expect(second.idempotencyKey).toBe('welcome:profile-1')
  })

  it('claims a pending row and marks it sent after provider acceptance', async () => {
    await queueEmail({
      db,
      idempotencyKey: 'enrollment:tournament-1:profile-1',
      profileId: 'profile-1',
      to: 'player@example.test',
      template: 'enrollment_confirmed',
      data: {
        firstName: 'Player',
        tournamentName: 'Open Test',
        startDate: '2026-08-20',
      },
    })

    const fetchImpl = async () => new Response(
      JSON.stringify({ id: 'resend-message-1' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )

    const result = await processEmailOutboxBatch({
      db,
      apiKey: 'test-key',
      fetchImpl,
      now: new Date('2026-08-02T12:00:00Z'),
    })
    const [row] = await queryClient<{
      status: string
      attempts: number
      providerMessageId: string | null
      sentAt: Date | null
    }[]>`
      SELECT status, attempts, "providerMessageId", "sentAt"
      FROM email_logs
      WHERE "idempotencyKey" = 'enrollment:tournament-1:profile-1'
    `

    expect(result).toMatchObject({ claimed: 1, sent: 1, failed: 0 })
    expect(row).toMatchObject({
      status: 'sent',
      attempts: 1,
      providerMessageId: 'resend-message-1',
      sentAt: expect.anything(),
    })
  })

  it('schedules provider failures with backoff instead of retrying immediately', async () => {
    await queueEmail({
      db,
      idempotencyKey: 'waitlist:tournament-1:profile-2',
      profileId: 'profile-2',
      to: 'waitlisted@example.test',
      template: 'waitlisted',
      data: { firstName: 'Wait', tournamentName: 'Open Test' },
    })

    const now = new Date('2026-08-02T12:00:00Z')
    const rejected = async () => new Response('provider unavailable', { status: 503 })
    const first = await processEmailOutboxBatch({
      db,
      apiKey: 'test-key',
      fetchImpl: rejected,
      now,
    })
    const [row] = await queryClient<{
      status: string
      attempts: number
      nextAttemptAt: string
      error: string | null
    }[]>`
      SELECT status, attempts, "nextAttemptAt", error
      FROM email_logs
      WHERE "idempotencyKey" = 'waitlist:tournament-1:profile-2'
    `
    const immediate = await processEmailOutboxBatch({
      db,
      apiKey: 'test-key',
      fetchImpl: rejected,
      now: new Date(now.getTime() + 30_000),
    })

    expect(first).toMatchObject({ claimed: 1, sent: 0, failed: 1 })
    expect(row).toMatchObject({
      status: 'pending',
      attempts: 1,
      error: 'provider unavailable',
    })
    expect(new Date(row.nextAttemptAt).getTime()).toBe(now.getTime() + 60_000)
    expect(immediate.claimed).toBe(0)
  })

  it('releases a claimed row when the provider call throws', async () => {
    await queueEmail({
      db,
      idempotencyKey: 'cancel:tournament-1:profile-3',
      profileId: 'profile-3',
      to: 'cancelled@example.test',
      template: 'cancellation',
      data: { firstName: 'Cancel', tournamentName: 'Open Test' },
      maxAttempts: 1,
    })

    const result = await processEmailOutboxBatch({
      db,
      apiKey: 'test-key',
      fetchImpl: async () => { throw new Error('network down') },
      now: new Date('2026-08-02T12:00:00Z'),
    })
    const [row] = await queryClient<{
      status: string
      attempts: number
      lockedAt: string | null
      error: string | null
    }[]>`
      SELECT status, attempts, "lockedAt", error
      FROM email_logs
      WHERE "idempotencyKey" = 'cancel:tournament-1:profile-3'
    `

    expect(result).toMatchObject({ claimed: 1, sent: 0, failed: 1 })
    expect(row).toMatchObject({
      status: 'failed',
      attempts: 1,
      lockedAt: null,
      error: 'network down',
    })
  })

  it('reclaims processing rows whose lease expired after a worker crash', async () => {
    await queueEmail({
      db,
      idempotencyKey: 'reminder:tournament-1:profile-4',
      profileId: 'profile-4',
      to: 'reminder@example.test',
      template: 'tournament_reminder',
      data: { firstName: 'Reminder', tournamentName: 'Open Test', startTime: '09:00' },
    })
    await queryClient`
      UPDATE email_logs
      SET status = 'processing', "lockedAt" = '2026-08-02T11:50:00Z'
      WHERE "idempotencyKey" = 'reminder:tournament-1:profile-4'
    `

    const result = await processEmailOutboxBatch({
      db,
      apiKey: 'test-key',
      fetchImpl: async () => new Response(
        JSON.stringify({ id: 'recovered-message' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
      now: new Date('2026-08-02T12:00:00Z'),
    })

    expect(result).toMatchObject({ claimed: 1, sent: 1, failed: 0 })
  })
})
