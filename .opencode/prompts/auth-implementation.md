# Prompt: Auth Implementation

## Goal
Implement full auth flow: login, signup, session management, role-based access.

## Supabase Setup
- Project en Supabase con Auth habilitado
- Providers: email + magic link, Google OAuth
- Tables: `profiles` (extends auth.users), `organizations`, `organization_members`

## DB Schema (Auth-related)
```ts
// profiles: id (references auth.users), firstName, lastName, role ('organizer' | 'player')
// organizations: id, name, slug, stripeAccountId
// organization_members: id, organizationId, profileId, role ('owner' | 'admin' | 'member')
```

## API Middleware
- `requireAuth` — verifica JWT, extrae userId
- `requireOrgAccess` — verifica que userId pertenece a orgId
- `requireOrgRole('owner')` — verifica rol específico en la org

## Web
- Next.js middleware.ts: proteger `/dashboard/*`, redirect a `/login`
- Páginas: `/login`, `/signup`, `/forgot-password`
- AuthProvider en layout: leer sesión de Supabase SSR
- Botón de profile menu (nombre, cerrar sesión)

## Mobile
- Pantalla de login con email + magic link
- Almacenar token en SecureStore
- AuthProvider: verificar token al arrancar, redirect a login si expiró

## Files
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/routers/auth.ts`
- `apps/web/src/middleware.ts`
- `apps/web/src/app/login/page.tsx`
- `apps/mobile/src/app/login.tsx`
- `packages/db/src/schema/profiles.ts`
- `packages/db/src/schema/organizations.ts`
