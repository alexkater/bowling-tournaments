# Core Development Rules

## Language & Style
- TypeScript estricto. Nunca usar `any`
- Validación con Zod en el boundary. Tipos inferidos con `z.infer`
- Prettier + ESLint. Sin excepciones

## Architecture
- Toda lógica de negocio va en `@bowling/shared`. No repetir lógica en web/mobile/api
- Las mutaciones van por tRPC. No mutar el estado local sin pasar por la API
- Los tipos se definen en `@bowling/shared/src/types/` primero, luego se usan en todas partes

## Testing
- Tests unitarios obligatorios para lógica de handicap, brackets, payouts
- Integration tests para routers tRPC
- E2E con Playwright para flujos críticos del organizador

## Git
- Commits atómicos. Un cambio por commit
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`
- PRs pequeños (< 300 líneas)

## Database
- Migraciones vía Drizzle Kit. No editar la DB manualmente
- Todo cambio de schema pasa por revisión
- Usar UUIDs para IDs, timestamps con zona horaria
