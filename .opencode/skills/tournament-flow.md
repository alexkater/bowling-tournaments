# Skill: Tournament Flow — Implementar un flujo completo de torneo

## Cuándo usarlo
Cada vez que implementes una feature que atraviese varias capas (shared → db → api → web/mobile).

## Flujo típico
1. **Shared** — tipos y schemas Zod (ya existen, usar existentes o extender)
2. **DB** — schema de tablas + migración
3. **API** — router tRPC + servicio con lógica de negocio
4. **Web** — página/formulario para organizadores
5. **Mobile** — vista para jugadores (cuando aplique)

## Capas que NO deben mezclarse

| Capa | Responsabilidad | Prohibido |
|---|---|---|
| `@bowling/shared` | Tipos, validación, lógica pura | Importar DB, API, React |
| `@bowling/db` | Schema Drizzle, migraciones | Lógica de negocio, tipos de dominio |
| `apps/api` | tRPC routers, servicios | UI, lógica de presentación |
| `apps/web` | UI organizador | Lógica de negocio, acceso directo a DB |
| `apps/mobile` | UI jugador | Lógica de negocio, acceso directo a DB |

## Validación de estado
Para flujos con múltiples pasos, validar transiciones de estado:
```ts
const TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  draft: ['published'],
  published: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}
```
