# Handoff — Strike Manager

## Estado actual (15 Jul 2026)

### Completado
- Domain core: 116 tests, 7 engines (handicap, brackets, payouts, tiebreaker, state-machine, sidepots, validation)
- API: 7 routers + 3 services + WebSocket manager + auth middleware con verificación real de membresía/roles
- Web: 12 páginas + WebSocket hook (`useStandingsSocket`)
- Mobile: 5 pantallas
- Auth: PostgreSQL + bcrypt + JWT (JWT_SECRET obligatorio, sin fallback hardcodeado)
- Domain validations: fechas, stages, format compatibility implementadas y testeadas
- Tests: 143 total (116 unit + 27 integration)
- Docker: Dockerfile.api, Dockerfile.web, docker-compose.prod.yml
- CI/CD: GitHub Actions
- Compilación: shared ✅ api ✅ (typecheck limpio)

### Arreglos recientes (esta sesión)
1. JWT_SECRET sin fallback hardcodeado (lazy init, requiere variable de entorno)
2. requireOrgAccess: verifica membresía real en organization_members
3. requireOrgRole: verifica rol contra la BD
4. Domain validations: validateDates, validateStageNames, validateStageOrder, validateStepladderOnlyLast, validateBracketSeedingAdvancement
5. WebSocket standings: manager con heartbeat, endpoint `/ws/standings/:squadId`, broadcast en enterScore/batchEnterScores
6. Servicios extraídos: score.service, standings.service, sidepot.service
7. Hook React: `useStandingsSocket(squadId)` en web

### Por hacer (HITO 1 — Poner en producción)
1. Configurar Docker en Hetzner (IP: 178.104.71.198, key: ~/.ssh/nest_deploy)
2. Adaptar docker-compose.prod.yml y .env para producción
3. SSL con Caddy (Let's Encrypt, sin dominio → usar IP o dominio temporal)
4. Verificar puertos 80/443 abiertos en Hetzner firewall
5. Deploy y test

### Comandos útiles
```bash
cd /Users/ale/bowling-tournaments
pnpm dev                    # Start all dev servers
pnpm --filter @bowling/shared test  # Unit tests (116)
pnpm --filter @bowling/api test     # Integration tests (27)
pnpm --filter @bowling/api typecheck
pnpm --filter @bowling/shared typecheck
# Deploy a Hetzner
ssh -i ~/.ssh/nest_deploy root@178.104.71.198
```

### Datos del servidor
- IP: 178.104.71.198
- User: root
- Key: ~/.ssh/nest_deploy
- Sin dominio por ahora
