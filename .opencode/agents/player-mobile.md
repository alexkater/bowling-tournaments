# Agent: Player Mobile

## Purpose
Build and maintain the Expo React Native app for tournament players. Players use this to see standings, brackets, sidepots, and manage their profile.

## Domain
- Browse tournaments (list, search, filter)
- Tournament detail (info, dates, format, pricing)
- Registration (sign up for a tournament, choose events, pay)
- Standings (live standings with pull-to-refresh)
- Brackets (view bracket trees, still-alive status)
- Sidepots (view active sidepots, results)
- Profile (averages, history, USBC ID)
- Notifications (push: next round, bracket update, score alert)
- Check-in (QR code or manual)

## Stack
- Expo SDK 52
- React Native 0.76
- expo-router (file-based navigation)
- @tanstack/react-query (API)
- @trpc/client (tRPC)
- expo-secure-store (auth tokens)
- expo-notifications (push)

## Architecture

### Navigation (expo-router)
```
/(tabs)/
  /index        → Home (tournaments activos)
  /standings    → Standings en vivo
  /brackets     → Mis brackets
  /profile      → Perfil
/tournament/[id] → Detalle del torneo
/standings/[id]  → Standings de un squad
/bracket/[id]    → Bracket tree completo
/auth/login      → Login
/auth/signup     → Registro
```

### Data Flow
- API calls via tRPC client (wrapped in TanStack Query)
- Auth token stored in SecureStore
- WebSocket connection for real-time standings (connect when app foreground, disconnect on background)
- Cache: TanStack Query con staleTime configurable
  - Standings: 10s stale (se actualizan frecuentemente)
  - Tournament list: 60s stale
  - Profile: 5min stale

### Offline Resilience
- Si no hay conexión: mostrar última data de TanStack Query cache
- Si la cache está vacía: mostrar skeleton loading con mensaje
- No bloqueante: la app funciona principalmente online, pero no se rompe si hay un corte

## Design Guidelines
- iOS Human Interface Guidelines + Material Design 3 (adaptativo por plataforma)
- Tema oscuro por defecto (bowling alleys tienen luz baja)
- Tipografía grande (bowlers mayormente boomers)
- Touch targets de mínimo 48px
- Soporte Dynamic Type / Font Scaling

## Domain Knowledge
- Los jugadores ven brackets en los que están inscritos
- Las standings se auto-refrescan
- Los pagos se procesan en web (deep link a Stripe)
- Las notificaciones son para: ronda próxima, resultado de bracket, cambio de horario

## Performance
- FlashList para listas largas (standings, tournament list)
- Lazy load bracket trees (no renderizar matches ocultos)
- Imágenes optimizadas con expo-image
- Hermes engine habilitado

## Testing
- Detox para E2E: login → ver standings → ver bracket
- No snapshot tests
