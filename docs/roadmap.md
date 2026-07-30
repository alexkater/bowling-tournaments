# Roadmap

## Phase 1 — MVP (8-12 weeks)

**Goal**: Lanzar con un conjunto de features que compitan directamente con Tournament Doctor en el caso de uso más común: torneos individuales con brackets y sidepots.

### Sprint 1-2: Foundation
- [x] Monorepo setup (pnpm, turbo, typescript)
- [x] Shared package (tipos, schemas, handicap utils)
- [ ] DB schema + migrations (Drizzle)
- [ ] Auth (Supabase)
- [ ] API router base + health
- [ ] CI/CD (GitHub Actions)

### Sprint 3-4: Core Tournament Flow
- [ ] CRUD torneos
- [ ] Publicar torneo con página pública
- [ ] Registro de jugadores
- [ ] Gestión de squads + carriles
- [ ] Ingreso de puntuaciones
- [ ] Cálculo de handicap
- [ ] Clasificaciones en vivo
- [ ] Página pública de resultados

### Sprint 5-6: Brackets & Sidepots
- [ ] Bracket engine (shuffle, matches, advancement)
- [ ] UI de brackets (web)
- [ ] Sidepots (high game, high series)
- [ ] Eliminators
- [ ] Big Dog / Blind Draw
- [ ] Payout calculations

### Sprint 7-8: Polish & Launch
- [ ] Reportes PDF
- [ ] Payment processing (Stripe)
- [ ] Mobile app v1 (brackets + standings view)
- [ ] Onboarding + docs
- [ ] Beta con 3-5 centros

## Phase 2 — Growth (weeks 9-16)

- Multi-squad tournaments
- Stepladder finals
- All-Events
- Season points tracking
- Clone tournament
- Waitlist
- Notificaciones push
- Integración con scoring systems (Brunswick, QubicaAMF)

## Phase 3 — Scale (Q2+)

- League management
- Bracket rollover
- Offline score entry
- Lane crossing simulator
- Publicación a iBowlTournaments
- USBC database lookup
- Multi-language (ES, PT)
- Marketplace de torneos públicos

## Métricas de éxito (MVP)

- **5 centros** en beta activa
- **50 torneos** creados en el primer mes
- **NPS > 40** con organizadores
- **< 1s** latencia en clasificaciones en vivo
- **0** pérdida de datos documentada
