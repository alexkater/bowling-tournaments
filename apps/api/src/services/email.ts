import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { emailLogs } from '@bowling/db'
import crypto from 'crypto'

type EmailTemplate = 'welcome' | 'enrollment_confirmed' | 'waitlisted' | 'tournament_reminder' | 'results' | 'cancellation'

interface SendEmailParams {
  db: PostgresJsDatabase<any>
  profileId?: string
  to: string
  template: EmailTemplate
  data: Record<string, string>
}

export async function sendEmail(input: SendEmailParams) {
  const id = crypto.randomUUID()
  const apiKey = process.env.RESEND_API_KEY

  // Log attempt (best-effort, table may not exist in test env)
  try {
    await input.db.insert(emailLogs).values({
      id,
      profileId: input.profileId,
      to: input.to,
      template: input.template,
      status: 'pending',
    })
  } catch {}

  if (!apiKey) {
    console.log(`[email] Would send "${input.template}" to ${input.to} (RESEND_API_KEY not set)`)
    return { id, status: 'pending' }
  }

  // Build HTML from template + data
  const html = renderTemplate(input.template, input.data)

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Strike Manager <noreply@bolos.mogambo.xyz>',
        to: input.to,
        subject: getSubject(input.template, input.data),
        html,
      }),
    })

    const status = res.ok ? 'sent' : 'failed'
    const error = res.ok ? null : await res.text()

    await input.db.insert(emailLogs).values({
      id,
      profileId: input.profileId,
      to: input.to,
      template: input.template,
      status,
      error: error?.slice(0, 500),
      sentAt: status === 'sent' ? new Date() : null,
    })

    if (!res.ok) {
      console.error(`[email] Failed to send "${input.template}" to ${input.to}: ${error?.slice(0, 200)}`)
    }

    return { id, status }
  } catch (err: any) {
    await input.db.insert(emailLogs).values({
      id,
      profileId: input.profileId,
      to: input.to,
      template: input.template,
      status: 'failed',
      error: err.message?.slice(0, 500),
    })

    console.error(`[email] Error sending "${input.template}": ${err.message}`)
    return { id, status: 'failed' }
  }
}

function getSubject(template: EmailTemplate, data: Record<string, string>): string {
  switch (template) {
    case 'welcome': return `¡Bienvenido a Strike Manager, ${data.firstName}!`
    case 'enrollment_confirmed': return `✅ Inscripción confirmada — ${data.tournamentName}`
    case 'waitlisted': return `⏳ Lista de espera — ${data.tournamentName}`
    case 'tournament_reminder': return `⏰ ${data.tournamentName} empieza mañana`
    case 'results': return `🏆 Resultados — ${data.tournamentName}`
    case 'cancellation': return `❌ Inscripción cancelada — ${data.tournamentName}`
  }
}

function renderTemplate(template: EmailTemplate, data: Record<string, string>): string {
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
      return base(`<h2>¡Hola ${data.firstName}!</h2>
        <p>Tu cuenta de <strong>${data.role === 'organizer' ? 'Organizador' : 'Jugador'}</strong> ha sido creada exitosamente.</p>
        <p><a href="https://bolos.mogambo.xyz/login" style="color:#f59e0b">Inicia sesión aquí</a></p>`)

    case 'enrollment_confirmed':
      return base(`<h2>✅ Inscripción confirmada</h2>
        <p>${data.firstName}, quedaste registrado en <strong>${data.tournamentName}</strong>.</p>
        <p>📅 ${data.startDate} &mdash; 📍 ${data.league || 'Por confirmar'}</p>`)

    case 'waitlisted':
      return base(`<h2>⏳ Lista de espera</h2>
        <p>${data.firstName}, <strong>${data.tournamentName}</strong> está lleno. Quedaste en lista de espera.</p>
        <p>Te avisaremos si se libera un cupo.</p>`)

    case 'tournament_reminder':
      return base(`<h2>⏰ ${data.tournamentName} empieza mañana</h2>
        <p>¡Prepárate ${data.firstName}! El torneo arranca mañana a las ${data.startTime}.</p>`)

    case 'results':
      return base(`<h2>🏆 Resultados</h2>
        <p>${data.firstName}, los resultados de <strong>${data.tournamentName}</strong> están disponibles.</p>
        <p>Posición: <strong>${data.position || '—'}</strong> | Puntaje: <strong>${data.score || '—'}</strong></p>`)

    case 'cancellation':
      return base(`<h2>❌ Inscripción cancelada</h2>
        <p>${data.firstName}, tu registro en <strong>${data.tournamentName}</strong> ha sido cancelado.</p>`)

    default:
      return base(`<p>${JSON.stringify(data)}</p>`)
  }
}
