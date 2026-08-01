import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@bowling/db'
import {
  processEmailOutboxBatch,
  queueEmail,
  startEmailOutboxWorker,
} from '../services/email'

const TEST_PROVIDER_CREDENTIAL = ['test', 'provider', 'credential'].join('-')

const queryClient = postgres(
  process.env.DATABASE_URL ?? 'postgres://bowling:bowling@localhost:5432/bowling',
  { max: 1 },
)
const db = drizzle(queryClient, { schema })
const TEST_SENDER = 'Strike Manager <sender@example.test>'
const processBatch = (
  options: Omit<Parameters<typeof processEmailOutboxBatch>[0], 'from'>,
) => processEmailOutboxBatch({ ...options, from: TEST_SENDER })

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

    const result = await processBatch({
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

  it('preserves multiline announcement paragraphs in escaped HTML', async () => {
    await queueEmail({
      db,
      idempotencyKey: 'announcement:tournament-1:profile-1',
      profileId: 'profile-1',
      to: 'player@example.test',
      template: 'announcement',
      data: {
        subject: 'Schedule update',
        body: 'First line\n<script>alert(1)</script>\nThird line',
        tournamentName: 'Open Test',
      },
    })

    let providerBody: Record<string, string> | undefined
    await processBatch({
      db,
      apiKey: TEST_PROVIDER_CREDENTIAL,
      fetchImpl: async (_url, init) => {
        providerBody = JSON.parse(String(init?.body)) as Record<string, string>
        return new Response(
          JSON.stringify({ id: 'resend-announcement-1' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      },
      now: new Date('2026-08-02T12:00:00Z'),
    })

    expect(providerBody?.html).toContain(
      'First line<br>&lt;script&gt;alert(1)&lt;/script&gt;<br>Third line',
    )
  })

  it('refuses provider processing when the sender is missing', async () => {
    const onError = vi.fn()

    const stop = startEmailOutboxWorker({
      db,
      apiKey: TEST_PROVIDER_CREDENTIAL,
      onError,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    stop()

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0]?.[0]).toEqual(
      new Error('EMAIL_FROM is required when RESEND_API_KEY is configured'),
    )
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
    const first = await processBatch({
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
    const immediate = await processBatch({
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

    const result = await processBatch({
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

    const result = await processBatch({
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
