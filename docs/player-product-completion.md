# Player Product Completion — Definition of Done

## Goal

Strike Manager is ready for a closed customer beta when a real player can complete the full web journey without organizer intervention and without exposing another user's or organization's data.

## Actor journeys

### Player

1. Create a player account without creating an organization.
2. Sign in and land in the player area.
3. Browse only public tournaments (`published`, `in_progress`, or `completed`).
4. View tournament details, registration deadline, squads, capacity, and availability.
5. Register themselves in an eligible squad, or join a waitlist when permitted.
6. Cancel before the tournament begins; the first eligible waitlisted player is promoted.
7. View “My tournaments”, registration state, squad, scores, ranking, and winnings.
8. Edit only their own profile.

### Organizer

1. Create and publish a tournament.
2. Configure squads and capacity.
3. Search players only while authenticated and authorized.
4. View player registrations and waitlist state.
5. Enter scores and manage tournament resources only inside their own organization.

## Security invariants

- Public callers never receive profile email, phone, drafts, cancelled tournaments, private rosters, or organizer-only resources.
- Profile reads/updates and player history are scoped to the authenticated profile.
- Every organizer mutation verifies organization membership, required role, and resource ownership.
- Self-registration verifies authentication, player role, public tournament state, deadline, tournament/squad capacity, squad ownership, and duplicate registration.
- Capacity decisions are serialized in PostgreSQL to prevent oversubscription.
- Database constraints remain the final duplicate-registration boundary.

## Release gates

- TDD for every behavior change, with each new test observed failing first.
- Frozen install, typecheck, lint, unit/integration tests, infrastructure tests, build, schema check, Compose validation, and production dependency audit.
- Playwright covers player signup → browse → register → My tournaments → cancel and organizer visibility.
- Playwright runs in CI against an isolated PostgreSQL service.
- Independent review has no blocking findings.
- PR and Production Gate are green before merge.
- Production deploy creates and validates a database backup and has image rollback.
- Public DNS, TLS, web, API, tRPC, and synthetic customer journey pass after deploy.

## Delivery slices

1. API security and player identity.
2. Registration lifecycle and migration.
3. Player web portal and organizer publication controls.
4. CI-enforced browser E2E and release hardening.
