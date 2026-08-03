import { createDecipheriv, createHash } from 'node:crypto'
import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://bowling:bowling_dev@localhost:5432/bowling'
const ACTION_LINK_KEY_CONTEXT = 'strike-manager:action-link:v1'
const sql = postgres(DATABASE_URL, { max: 1 })

function decryptActionUrl(encrypted: string): string {
  const [ivEncoded, tagEncoded, ciphertextEncoded] = encrypted.split('.')
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error('Malformed encrypted action URL')
  }

  const secret = process.env.JWT_SECRET ?? 'test-only-secret'
  const key = createHash('sha256').update(`${ACTION_LINK_KEY_CONTEXT}\0${secret}`).digest()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivEncoded, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export async function latestActionUrl(
  email: string,
  template: 'verify_email' | 'password_reset',
): Promise<string> {
  const [row] = await sql<{ actionUrlEncrypted: string }[]>`
    SELECT payload->>'actionUrlEncrypted' AS "actionUrlEncrypted"
    FROM email_logs
    WHERE "to" = ${email} AND template = ${template}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `

  if (!row?.actionUrlEncrypted) throw new Error(`No ${template} outbox row found for test account`)
  return decryptActionUrl(row.actionUrlEncrypted)
}

export function actionToken(actionUrl: string): string {
  const token = new URL(actionUrl).searchParams.get('token')
  if (!token) throw new Error('Action URL is missing token')
  return token
}
