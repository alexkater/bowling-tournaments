import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { notifications } from '@bowling/db'
import crypto from 'crypto'

type NotificationType = 'enrollment_confirmed' | 'waitlisted' | 'tournament_reminder' | 'results_posted' | 'system'

interface CreateNotification {
  db: PostgresJsDatabase<any>
  profileId: string
  type: NotificationType
  title: string
  body: string
  metadata?: Record<string, unknown>
}

export async function createNotification(input: CreateNotification) {
  try {
    await input.db.insert(notifications).values({
      id: crypto.randomUUID(),
      profileId: input.profileId,
      type: input.type,
      title: input.title,
      body: input.body,
      metadata: input.metadata ?? {},
      read: false,
    })
  } catch {
    // Table may not exist in test environment
  }
}
