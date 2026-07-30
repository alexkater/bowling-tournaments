# Error Handling

## API Errors (tRPC)
Todos los errores usan TRPCError con códigos HTTP estándar:

| Situación | Código | HTTP Status |
|---|---|---|
| Token inválido o ausente | UNAUTHORIZED | 401 |
| Sin permisos para el recurso | FORBIDDEN | 403 |
| Recurso no encontrado | NOT_FOUND | 404 |
| Input inválido | BAD_REQUEST | 400 |
| Conflicto (duplicado, estado inválido) | CONFLICT | 409 |
| Error interno no esperado | INTERNAL_SERVER_ERROR | 500 |

```ts
// Correcto
throw new TRPCError({ code: 'NOT_FOUND', message: 'Tournament not found' })

// Incorrecto — return null o undefined
return null  // ❌ El cliente no sabe si es 404 o error
```

## Errores de validación
Los schemas Zod producen errores estructurados automáticamente. No customizar mensajes de error Zod a menos que sea necesario.

## Errores en Web
- TanStack Query: `error` state tipado, mostrar toast para mutaciones
- Form errors: Zod + React Hook Form, error por campo
- Network errors: toast "Connection lost, retrying..."
- 404 del server: `notFound()` de Next.js
- 401 del server: redirect a login

```tsx
// Patrón para mutations
const mutation = api.tournament.create.useMutation({
  onError: (error) => {
    toast.error(error.message)
  },
  onSuccess: (data) => {
    router.push(`/dashboard/tournaments/${data.id}`)
  },
})
```

## Errores en Mobile
- Toast para errores de mutación
- Alert para errores críticos (no se pudo cargar la pantalla)
- Snackbar para errores de conexión recuperables

## No silenciar errores
❌ `catch (e) {}`
✅ `catch (e) { logger.error(e); throw new TRPCError(...) }`

## Logging
- API: pino (logger de Fastify) con structured logging
- Web: console.error en development, servicio de error tracking en production (Sentry)
- Errores de validación Zod: log con input sanitizado (sin datos sensibles)
