# State Management

## Principio
El server es la single source of truth. El cliente cachea y optimistic-update, pero nunca es dueño de los datos.

## TanStack Query
- `queryKey` estructurada: `['tournament', id]`, `['standings', squadId]`
- `staleTime` por tipo de datos:
  - Standings: 10s (cambian cada score entry)
  - Tournament list: 30s
  - Tournament detail: 60s
  - Player profile: 5min
  - Reference data (centers, organizations): 10min
- Mutations: `onSuccess` invalida queries relacionadas

```ts
const utils = api.useUtils()

const createMutation = api.tournament.create.useMutation({
  onSuccess: () => {
    utils.tournament.list.invalidate()
  },
})
```

## Estado de UI
- URL search params para: tab activo, filtros, paginación
- React state local para: modals abiertos, hover states, drag and drop
- No compartir estado de UI entre rutas diferentes

## WebSocket
- Conectar al entrar a una página de standings
- Desconectar al salir (cleanup en useEffect)
- El mensaje del server reemplaza los datos en caché de TanStack Query
- Optimistic: al recibir un `score_updated`, actualizar la UI inmediatamente antes de que llegue el `standings_update` completo

## Form State
- React Hook Form + Zod resolver para todos los formularios
- Schema Zod en `@bowling/shared` reutilizado en web y api
- Los errores se muestran por campo, no globales
