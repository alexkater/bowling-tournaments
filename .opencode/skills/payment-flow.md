# Skill: Payment Flow — Integrar pagos con Stripe

## Cuándo usarlo
Cada vez que implementes cobro de inscripciones, sidepots, o pagos a ganadores.

## Esquema
- Stripe Connect para split payments (Stripe se lleva fee, organizador recibe el neto)
- Los jugadores pagan online al registrarse
- El organizador configura el precio del torneo y sidepots
- Stripe cobra, nosotros retenemos nuestra comisión, el resto va al organizador/centro

## Modelo de datos
```ts
// En payment_transactions
{
  id: string
  tournamentId: string
  playerId: string
  type: 'registration' | 'sidepot' | 'bracket'
  amount: number       // centavos USD
  stripePaymentId: string
  status: 'pending' | 'completed' | 'refunded'
}
```

## Flujo checkout
1. Player hace clic en "Register & Pay"
2. API crea un Stripe Checkout Session
3. Player es redirigido a Stripe
4. Stripe webhook notifica a nuestra API
5. API confirma el pago y activa la inscripción
6. API emite WebSocket de confirmación

## Webhooks
- Endpoint `POST /api/stripe/webhook` (fuera de tRPC, raw body)
- Eventos a manejar: `checkout.session.completed`, `charge.refunded`
- Idempotencia: usar `stripe-signature` + clave de idempotencia

## Precios
- Precios en cents (USD) en la DB
- Stripe cobra 2.9% + $0.30 por transacción
- Nuestra comisión: 5% del entry fee o $1 flat (según modelo final)
