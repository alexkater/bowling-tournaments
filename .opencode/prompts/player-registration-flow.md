# Prompt: Player Registration Flow

## Goal
Implement the full registration flow: player signs up, picks squad, chooses events, pays, gets confirmed.

## Flujo
1. Player busca torneo (página pública)
2. Player ve detalle del torneo (fechas, formato, precio)
3. Player selecciona squad (si hay múltiples)
4. Player elige eventos (singles, doubles, trios, teams)
5. Player selecciona partners (para doubles/trios)
6. Player paga (Stripe Checkout)
7. API confirma pago vía webhook
8. Player aparece en roster del torneo
9. Organizador ve la inscripción en el dashboard

## DB Schema
- `tournament_players`: id, tournamentId, playerId, squadId, teamId, checkedIn, lane, createdAt
- `event_entries`: id, tournamentPlayerId, eventType, partners (jsonb: string[])
- `payment_transactions`: id, tournamentPlayerId, type, amount, stripePaymentId, status

## API
- `tournament.registerPlayer` — crea tournament_player, event_entries, redirect a Stripe
- `tournament.confirmRegistration` — webhook Stripe, activa inscripción
- `tournament.getRegistration` — estado de la inscripción del player
- `tournament.listPlayers` — roster del torneo (organizer)

## Web (Público)
- Página pública `/tournaments/[id]` — info + botón "Register"
- Flujo de registro paso a paso (multi-step form)
- Confirmación post-pago

## Web (Organizador)
- Roster view en dashboard del torneo
- Check-in manual
- Esperar lista de espera

## Reglas
- No permitir registro si torneo está lleno (maxPlayers)
- Si hay waitlist, añadir a waitlist y notificar al organizador
- Un player no puede registrarse dos veces al mismo torneo
- Partners deben ser players registrados en el mismo torneo
