import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { notifications } from '@bowling/db'
import crypto from 'crypto'

export type NotificationType =
  | 'enrollment_confirmed'
  | 'waitlisted'
  | 'promoted'
  | 'enrollment_cancelled'
  | 'tournament_reminder'
  | 'results_posted'
  | 'announcement'
  | 'system'

interface CreateNotification {
  db: PostgresJsDatabase<any>
  profileId: string
  type: NotificationType
  title: string
  body: string
  metadata?: Record<string, unknown>
  id?: string
}

export async function createNotification(input: CreateNotification) {
  const insert = input.db.insert(notifications).values({
    id: input.id ?? crypto.randomUUID(),
    profileId: input.profileId,
    type: input.type,
    title: input.title,
    body: input.body,
    metadata: input.metadata ?? {},
    read: false,
  })

  if (input.id) {
    await insert.onConflictDoNothing({ target: notifications.id })
    return
  }
  await insert
}
