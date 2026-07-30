# Database Conventions

## Schema Design
- **IDs**: UUID v4 generados en la aplicación (`crypto.randomUUID()`), no secuenciales
- **Timestamps**: `created_at` y `updated_at` en TODAS las tablas
- **Soft delete**: NO. Usar status/state en su lugar (ej: `is_active: boolean`)
- **JSON columns**: solo para configuraciones flexibles, no para datos relacionales
- **Índices**: crear índices para foreign keys y columnas de búsqueda frecuente

## Tipos de columna
```ts
id: text().primaryKey().$defaultFn(() => crypto.randomUUID())
organizationId: text().notNull().references(() => organizations.id, { onDelete: 'cascade' })
name: text().notNull()
description: text()
sortOrder: integer().notNull().default(0)
isActive: boolean().notNull().default(true)
config: jsonb().$type<TournamentConfig>().notNull().default({})
status: text().notNull().default('draft')  // usa union types
createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())
```

## Migraciones
- Generar: `pnpm --filter @bowling/db generate`
- Aplicar: `pnpm --filter @bowling/db migrate`
- Una migración por cambio. Si son varios cambios relacionados, mismo migration file
- No editar migration files generados. Si algo sale mal, crear nueva migración
- Named migrations: `pnpm --filter @bowling/db generate --name <description>`

## Queries
- Usar Drizzle queries tipadas. No SQL raw a menos que sea estrictamente necesario
- SELECT explícito de columnas (no `select()` sin argumentos)
- Paginación con cursor, no offset. El cursor es el id del último item

## Seed Data
- `packages/db/src/seed.ts` — datos de desarrollo
- Seed: organzación de prueba, torneos de ejemplo, players fake
- Ejecutar con `tsx packages/db/src/seed.ts`
