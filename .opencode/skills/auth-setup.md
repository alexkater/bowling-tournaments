# Skill: Auth Setup — Configurar autenticación

## Cuándo usarlo
Cada vez que necesites configurar rutas protegidas, roles de usuario o integración con Supabase Auth.

## Esquema
- Supabase Auth para el sistema de login (email + magic link / OAuth)
- Sesión vía JWT en cabecera `Authorization: Bearer <token>`
- Dos roles: `organizer` (dueño del centro/organizador) y `player` (jugador)

## API — Middleware de auth
```ts
// apps/api/src/middleware/auth.ts
import { TRPCError } from '@trpc/server'
import { middleware } from '../trpc'

export const requireAuth = middleware(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, userId: ctx.userId } })
})

export const requireOrgAccess = middleware(({ ctx, next }) => {
  if (!ctx.orgId) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, orgId: ctx.orgId } })
})
```

## Uso en procedures
```ts
import { requireAuth } from '../middleware/auth'

export const adminProcedure = procedure.use(requireAuth)
export const orgProcedure = adminProcedure.use(requireOrgAccess)
```

## Web — Next.js
- `middleware.ts` en la raíz de `apps/web` para redirect si no hay sesión
- Supabase SSR client para server components
- Páginas de login en `/login`, dashboard protegido en `/dashboard`

## Mobile — Expo
- `expo-secure-store` para almacenar el token
- `@supabase/supabase-js` con el wrapper para React Native
- Pantalla de login si no hay token al arrancar
