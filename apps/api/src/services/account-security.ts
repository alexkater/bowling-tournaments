import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

const ACTION_LINK_KEY_CONTEXT = 'strike-manager:action-link:v1'

export function createAuthToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashAuthToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

function deriveActionLinkKey(secret: string): Buffer {
  if (!secret) throw new Error('Action-link encryption secret is required')
  return createHash('sha256')
    .update(ACTION_LINK_KEY_CONTEXT, 'utf8')
    .update('\0', 'utf8')
    .update(secret, 'utf8')
    .digest()
}

export function encryptActionUrl(url: string, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveActionLinkKey(secret), iv)
  const ciphertext = Buffer.concat([cipher.update(url, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, ciphertext].map((part) => part.toString('base64url')).join('.')
}

export function decryptActionUrl(encrypted: string, secret: string): string {
  const parts = encrypted.split('.')
  if (parts.length !== 3) throw new Error('Invalid encrypted action URL')
  const [ivPart, tagPart, ciphertextPart] = parts
  if (!ivPart || !tagPart || !ciphertextPart) throw new Error('Invalid encrypted action URL')

  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveActionLinkKey(secret),
    Buffer.from(ivPart, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export class RateLimitExceededError extends Error {
  constructor(readonly resetAt: Date) {
    super('Too many attempts. Please try again later.')
    this.name = 'RateLimitExceededError'
  }
}

interface ConsumeRateLimitInput {
  db: PostgresJsDatabase<any>
  secret: string
  action: string
  identifiers: string[]
  limit: number
  windowMs: number
  now?: Date
}

function createRateLimitKey(
  input: Pick<ConsumeRateLimitInput, 'secret' | 'action' | 'identifiers'>,
): string {
  return createHmac('sha256', input.secret)
    .update(input.action, 'utf8')
    .update('\0', 'utf8')
    .update(input.identifiers.map((value) => value.trim().toLowerCase()).join('\0'), 'utf8')
    .digest('hex')
}

export async function consumeRateLimit(input: ConsumeRateLimitInput) {
  if (input.limit < 1 || input.windowMs < 1) throw new Error('Invalid rate-limit configuration')
  const now = input.now ?? new Date()
  const expiresAt = new Date(now.getTime() + input.windowMs)
  const key = createRateLimitKey(input)

  const result = await input.db.execute(sql`
    WITH cleanup AS (
      DELETE FROM auth_rate_limits
      WHERE "expiresAt" < ${new Date(now.getTime() - 24 * 60 * 60_000).toISOString()}::timestamptz
      RETURNING key
    ), upserted AS (
      INSERT INTO auth_rate_limits (
        key, action, count, "windowStartedAt", "expiresAt", "updatedAt"
      ) VALUES (
        ${key}, ${input.action}, 1, ${now.toISOString()}::timestamptz,
        ${expiresAt.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz
      )
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN auth_rate_limits."expiresAt" <= EXCLUDED."windowStartedAt" THEN 1
          ELSE auth_rate_limits.count + 1
        END,
        "windowStartedAt" = CASE
          WHEN auth_rate_limits."expiresAt" <= EXCLUDED."windowStartedAt"
            THEN EXCLUDED."windowStartedAt"
          ELSE auth_rate_limits."windowStartedAt"
        END,
        "expiresAt" = CASE
          WHEN auth_rate_limits."expiresAt" <= EXCLUDED."windowStartedAt"
            THEN EXCLUDED."expiresAt"
          ELSE auth_rate_limits."expiresAt"
        END,
        "updatedAt" = EXCLUDED."updatedAt"
      RETURNING count, "expiresAt"
    )
    SELECT count, "expiresAt" FROM upserted
  `)
  const [row] = Array.from(result as unknown as Iterable<{ count: number; expiresAt: Date }>)
  if (!row) throw new Error('Rate-limit update failed')
  const resetAt = new Date(row.expiresAt)
  if (row.count > input.limit) throw new RateLimitExceededError(resetAt)

  return {
    count: row.count,
    remaining: Math.max(input.limit - row.count, 0),
    resetAt,
  }
}

export async function clearRateLimit(
  input: Pick<ConsumeRateLimitInput, 'db' | 'secret' | 'action' | 'identifiers'>,
) {
  const key = createRateLimitKey(input)
  await input.db.execute(sql`DELETE FROM auth_rate_limits WHERE key = ${key}`)
}
