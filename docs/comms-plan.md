# Plan de Comunicaciones — Bowling Tournaments

## Alcance
Implementar comunicaciones multicanal: email transaccional, notificaciones in-app, y mensajería Telegram.

## Fases

### Fase 1: Notificaciones In-App (P1)
- [ ] Schema: tabla `notifications` (id, profileId, type, title, body, metadata, read, createdAt)
- [ ] API: `notification.list`, `notification.markRead`, `notification.markAllRead`, `notification.unreadCount`
- [ ] Web: ícono de campana en nav, dropdown con lista, badge de no leídos
- [ ] Triggers: registro confirmado, waitlist, a punto de empezar

### Fase 2: Email Transaccional (P0)
- [ ] Provider: Resend (SDK simple, tier gratuito)
- [ ] Config: `RESEND_API_KEY` en .env
- [ ] Templates: confirmación, recordatorio 24h antes, resultados, cancelación
- [ ] Service: `sendEmail(to, templateId, data)` con retry y logging
- [ ] Schema: tabla `email_logs` (id, to, template, status, sentAt)
- [ ] Triggers transaccionales: signup → bienvenida, enrollment → confirmación, cancel → confirmación cancel
- [ ] Cron opcional: recordatorio 24h antes del torneo

### Fase 3: Resultados y Resumen Post-Torneo (P2)
- [ ] Email automático cuando organizer marca torneo como "completed"
- [ ] Incluye: posición final, puntaje, premio si aplica

### Fase 4: Canal Telegram (P3)
- [ ] Campo `telegramId` en profiles
- [ ] Bot existente @Perdonal_ale_bot envía notificaciones
- [ ] Comando /link para asociar cuenta

## Arquitectura
```
┌──────────────┐    ┌───────────────┐    ┌──────────┐
│  API Router  │───▶│ Notification  │───▶│   DB     │
│  (triggers)  │    │   Service     │    │          │
└──────────────┘    └───────┬───────┘    └──────────┘
                            │
                    ┌───────┴───────┐
                    │   Channels    │
                    ├───────────────┤
                    │ In-App (DB)   │
                    │ Email (Resend)│
                    │ Telegram (Bot)│
                    └───────────────┘
```

## Decisiones
- Resend sobre SendGrid: API más simple, mejor DX, tier gratuito suficiente
- Notificaciones in-app: tabla simple en DB, no WebSocket (sobreingeniería)
- Templates: server-side HTML con variables {{name}}, {{tournament}}
- Rate limiting: no más de 3 emails por usuario/día

## Estimación
- Fase 1: 8 endpoints + UI ~ 2h
- Fase 2: Resend + templates + triggers ~ 1.5h
- Fase 3: Resultados ~ 45min
- Fase 4: Telegram ~ 1h
