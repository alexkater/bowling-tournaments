import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { eq, sql } from 'drizzle-orm'
import { emailLogs } from '@bowling/db'
import crypto from 'crypto'
import { decryptActionUrl } from './account-security'

export type EmailTemplate =
  | 'welcome'
  | 'enrollment_confirmed'
  | 'waitlisted'
  | 'tournament_reminder'
  | 'results'
  | 'cancellation'
  | 'announcement'
  | 'verify_email'
  | 'password_reset'

export interface QueueEmailParams {
  db: PostgresJsDatabase<any>
  idempotencyKey: string
  profileId?: string
  to: string
  template: EmailTemplate
  data: Record<string, string>
  maxAttempts?: number
}

export async function queueEmail(input: QueueEmailParams) {
  const [created] = await input.db
    .insert(emailLogs)
    .values({
      id: crypto.randomUUID(),
      idempotencyKey: input.idempotencyKey,
      profileId: input.profileId,
      to: input.to,
      template: input.template,
      payload: input.data,
      maxAttempts: input.maxAttempts ?? 5,
    })
    .onConflictDoNothing({ target: emailLogs.idempotencyKey })
    .returning()

  if (created) return created

  const [existing] = await input.db
    .select()
    .from(emailLogs)
    .where(eq(emailLogs.idempotencyKey, input.idempotencyKey))
    .limit(1)

  if (!existing) throw new Error('Email outbox idempotency lookup failed')
  return existing
}

interface ProcessEmailOutboxOptions {
  db: PostgresJsDatabase<any>
  apiKey?: string
  from?: string
  fetchImpl?: typeof fetch
  now?: Date
  limit?: number
  actionLinkSecret?: string
}

interface ClaimedEmail {
  id: string
  idempotencyKey: string
  to: string
  template: EmailTemplate
  payload: Record<string, string>
  attempts: number
  maxAttempts: number
}

export async function processEmailOutboxBatch(options: ProcessEmailOutboxOptions) {
  if (!options.apiKey) {
    return { claimed: 0, sent: 0, failed: 0, reason: 'provider_unconfigured' as const }
  }
  const from = options.from?.trim()
  if (!from) {
    return { claimed: 0, sent: 0, failed: 0, reason: 'sender_unconfigured' as const }
  }

  const now = options.now ?? new Date()
  const nowIso = now.toISOString()
  const leaseCutoffIso = new Date(now.getTime() - 5 * 60_000).toISOString()
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100)
  const claimedResult = await options.db.execute(sql`
    WITH candidates AS (
      SELECT id
      FROM email_logs
      WHERE (
          (status = 'pending' AND "nextAttemptAt" <= ${nowIso}::timestamptz)
          OR (status = 'processing' AND "lockedAt" <= ${leaseCutoffIso}::timestamptz)
        )
        AND attempts < "maxAttempts"
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE email_logs AS delivery
    SET status = 'processing',
      "lockedAt" = ${nowIso}::timestamptz,
      "updatedAt" = ${nowIso}::timestamptz
    FROM candidates
    WHERE delivery.id = candidates.id
    RETURNING delivery.id,
      delivery."idempotencyKey",
      delivery."to",
      delivery.template,
      delivery.payload,
      delivery.attempts,
      delivery."maxAttempts"
  `)
  const claimed = Array.from(claimedResult as unknown as Iterable<ClaimedEmail>)
  const fetchImpl = options.fetchImpl ?? fetch
  let sent = 0
  let failed = 0

  for (const delivery of claimed) {
    const attempts = delivery.attempts + 1
    const recordFailure = async (message: string) => {
      const backoffMs = Math.min(60_000 * (2 ** (attempts - 1)), 60 * 60_000)
      await options.db
        .update(emailLogs)
        .set({
          status: attempts >= delivery.maxAttempts ? 'failed' : 'pending',
          attempts,
          nextAttemptAt: new Date(now.getTime() + backoffMs),
          error: message.slice(0, 500),
          lockedAt: null,
          updatedAt: now,
        })
        .where(eq(emailLogs.id, delivery.id))
      failed += 1
    }

    try {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': delivery.idempotencyKey,
        },
        body: JSON.stringify({
          from,
          to: delivery.to,
          subject: getSubject(delivery.template, delivery.payload),
          html: renderTemplate(delivery.template, delivery.payload, options.actionLinkSecret),
        }),
      })

      if (!response.ok) {
        await recordFailure(await response.text())
        continue
      }

      const providerPayload = await response.json().catch(() => ({})) as { id?: string }
      await options.db
        .update(emailLogs)
        .set({
          status: 'sent',
          attempts,
          providerMessageId: providerPayload.id ?? null,
          error: null,
          lockedAt: null,
          updatedAt: now,
          sentAt: now,
        })
        .where(eq(emailLogs.id, delivery.id))
      sent += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown provider error'
      await recordFailure(message)
    }
  }

  return { claimed: claimed.length, sent, failed }
}

interface StartEmailWorkerOptions {
  db: PostgresJsDatabase<any>
  apiKey?: string
  from?: string
  intervalMs?: number
  onError?: (error: unknown) => void
  actionLinkSecret?: string
}

export function startEmailOutboxWorker(options: StartEmailWorkerOptions) {
  if (!options.apiKey) return () => undefined
  if (!options.from?.trim()) {
    options.onError?.(new Error('EMAIL_FROM is required when RESEND_API_KEY is configured'))
    return () => undefined
  }

  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      await processEmailOutboxBatch({
        db: options.db,
        apiKey: options.apiKey,
        from: options.from,
        actionLinkSecret: options.actionLinkSecret,
      })
    } catch (error) {
      options.onError?.(error)
    } finally {
      running = false
    }
  }

  void tick()
  const timer = setInterval(() => void tick(), options.intervalMs ?? 15_000)
  timer.unref()
  return () => clearInterval(timer)
}

function getSubject(template: EmailTemplate, data: Record<string, string>): string {
  switch (template) {
    case 'welcome': return sanitizeSubject(`¡Bienvenido a Strike Manager, ${data.firstName}!`)
    case 'enrollment_confirmed': return sanitizeSubject(`✅ Inscripción confirmada — ${data.tournamentName}`)
    case 'waitlisted': return sanitizeSubject(`⏳ Lista de espera — ${data.tournamentName}`)
    case 'tournament_reminder': return sanitizeSubject(`⏰ ${data.tournamentName} empieza mañana`)
    case 'results': return sanitizeSubject(`🏆 Resultados — ${data.tournamentName}`)
    case 'cancellation': return sanitizeSubject(`❌ Inscripción cancelada — ${data.tournamentName}`)
    case 'announcement': return sanitizeSubject(`📢 ${data.subject}`)
    case 'verify_email': return 'Verifica tu cuenta de Strike Manager'
    case 'password_reset': return 'Restablece tu contraseña de Strike Manager'
  }
}

function sanitizeSubject(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim().slice(0, 200)
}

function escapeHtml(value: string | undefined): string {
  return (value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderTemplate(
  template: EmailTemplate,
  data: Record<string, string>,
  actionLinkSecret?: string,
): string {
  const safe = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, escapeHtml(value)]),
  ) as Record<string, string>
  const base = (body: string) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#e2e8f0;background:#0f172a">
  <h1 style="color:#f59e0b">🎳 Strike Manager</h1>
  ${body}
  <hr style="border-color:#1e293b;margin-top:32px">
  <p style="color:#64748b;font-size:12px">Este es un email automático de Strike Manager. No respondas a este mensaje.</p>
</body></html>`

  switch (template) {
    case 'welcome':
      return base(`<h2>¡Hola ${safe.firstName}!</h2>
        <p>Tu cuenta de <strong>${safe.role === 'organizer' ? 'Organizador' : 'Jugador'}</strong> ha sido creada exitosamente.</p>
        <p><a href="https://bolos.mogambo.xyz/login" style="color:#f59e0b">Inicia sesión aquí</a></p>`)
    case 'enrollment_confirmed':
      return base(`<h2>✅ Inscripción confirmada</h2>
        <p>${safe.firstName}, quedaste registrado en <strong>${safe.tournamentName}</strong>.</p>
        <p>📅 ${safe.startDate} &mdash; 📍 ${safe.league || 'Por confirmar'}</p>`)
    case 'waitlisted':
      return base(`<h2>⏳ Lista de espera</h2>
        <p>${safe.firstName}, <strong>${safe.tournamentName}</strong> está lleno. Quedaste en lista de espera.</p>
        <p>Te avisaremos si se libera un cupo.</p>`)
    case 'tournament_reminder':
      return base(`<h2>⏰ ${safe.tournamentName} empieza mañana</h2>
        <p>¡Prepárate ${safe.firstName}! El torneo arranca mañana a las ${safe.startTime}.</p>`)
    case 'results':
      return base(`<h2>🏆 Resultados</h2>
        <p>${safe.firstName}, los resultados de <strong>${safe.tournamentName}</strong> están disponibles.</p>
        <p>Posición: <strong>${safe.position || '—'}</strong> | Puntaje: <strong>${safe.score || '—'}</strong></p>`)
    case 'cancellation':
      return base(`<h2>❌ Inscripción cancelada</h2>
        <p>${safe.firstName}, tu registro en <strong>${safe.tournamentName}</strong> ha sido cancelado.</p>`)
    case 'announcement':
      return base(`<h2>📢 ${safe.subject}</h2>
        <p>${(safe.body ?? '').replace(/\r?\n/g, '<br>')}</p>
        <p>Sobre el torneo: <strong>${safe.tournamentName}</strong></p>`)
    case 'verify_email': {
      if (!actionLinkSecret) throw new Error('Action-link encryption secret is required')
      const actionUrl = escapeHtml(decryptActionUrl(data.actionUrlEncrypted ?? '', actionLinkSecret))
      return base(`<h2>Verifica tu cuenta</h2>
        <p>Hola ${safe.firstName}, confirma que este correo te pertenece para activar tu cuenta.</p>
        <p><a href="${actionUrl}" style="display:inline-block;background:#f59e0b;color:#0f172a;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Verificar mi cuenta</a></p>
        <p style="color:#94a3b8;font-size:13px">Este enlace expira en 24 horas. Si no creaste esta cuenta, ignora el mensaje.</p>`)
    }
    case 'password_reset': {
      if (!actionLinkSecret) throw new Error('Action-link encryption secret is required')
      const actionUrl = escapeHtml(decryptActionUrl(data.actionUrlEncrypted ?? '', actionLinkSecret))
      return base(`<h2>Restablece tu contraseña</h2>
        <p>Hola ${safe.firstName}, recibimos una solicitud para cambiar tu contraseña.</p>
        <p><a href="${actionUrl}" style="display:inline-block;background:#f59e0b;color:#0f172a;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Cambiar mi contraseña</a></p>
        <p style="color:#94a3b8;font-size:13px">Este enlace expira en 60 minutos. Si no solicitaste el cambio, ignora el mensaje.</p>`)
    }
  }
}
