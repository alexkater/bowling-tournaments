# Skill: tRPC Router — Añadir un nuevo router

## Cuándo usarlo
Cada vez que necesites crear un nuevo grupo de endpoints tRPC o añadir un procedure a un router existente.

## Estructura
- Cada router en `apps/api/src/routers/<nombre>.ts`
- Importar `router`, `procedure` desde `../trpc`
- Exportar e integrar en `apps/api/src/routers/index.ts`

## Patrón
```ts
import { z } from 'zod'
import { router, procedure } from '../trpc'
import { MySchema } from '@bowling/shared'

export const myRouter = router({
  list: procedure
    .input(z.object({ limit: z.number().default(20), cursor: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // ctx.userId, ctx.orgId disponibles
      return { items: [], nextCursor: null }
    }),

  byId: procedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      return null
    }),

  create: procedure
    .input(MySchema)
    .mutation(async ({ ctx, input }) => {
      return { id: crypto.randomUUID() }
    }),
})
```

## Reglas
- `query` para GET (lectura), `mutation` para POST/PUT/DELETE (escritura)
- Validación con Zod en cada procedure. Nunca confiar en el cliente
- Los schemas Zod van en `@bowling/shared`, no en la API
- `ctx` tipado desde `apps/api/src/context.ts`
- Procedures públicos (sin auth) vs privados (con middleware auth)
- Paginación con cursor para listas
- Errores con TRPCError, códigos: UNAUTHORIZED, NOT_FOUND, BAD_REQUEST, CONFLICT
