# Skill: DB Schema — Añadir una nueva tabla

## Cuándo usarlo
Cada vez que necesites crear una nueva tabla en la base de datos.

## Estructura
Las tablas se definen en `packages/db/src/schema/`. Cada tabla en su propio archivo.

## Convenciones
- `id`: text().primaryKey().$defaultFn(() => crypto.randomUUID())
- `createdAt`: timestamp().notNull().defaultNow()
- `updatedAt`: timestamp().notNull().defaultNow().$onUpdate(() => new Date())
- `organizationId`: foreign key a organizations (casi siempre)
- Foreign keys con `references(() => tabla.id, { onDelete: 'cascade' })`
- Timestamps siempre en UTC
- Nombres en snake_case para columnas, camelCase para TypeScript

## Pasos
1. Crear `packages/db/src/schema/<nombre>.ts`
2. Definir el schema con `pgTable`
3. Añadir relaciones en `packages/db/src/schema/relations.ts`
4. Exportar desde `packages/db/src/schema/index.ts`
5. Ejecutar `pnpm --filter @bowling/db generate` para generar migración
6. Si toca tipos en shared, actualizar `packages/shared/src/types/`

## Template
```ts
import { pgTable, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { organizations } from './organizations'

export const myEntity = pgTable('my_entity', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text().notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  config: jsonb().$type<MyConfig>().notNull().default({}),
  sortOrder: integer().notNull().default(0),
  isActive: boolean().notNull().default(true),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})
```
