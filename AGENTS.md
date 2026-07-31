# Strike Manager / Bowling Tournaments Agent Rules

## Scope boundary

- This repository is the only product scope for work initiated from the Bowling Tournaments Telegram group.
- Canonical local workspace: `/Users/openclaw-runner/bowling-tournaments`.
- Canonical repository: `alexkater/bowling-tournaments`.
- Production scope: `/opt/bowling-tournaments` and `bolos.mogambo.xyz` on `nest_deploy`.
- Do not read, search, summarize, modify, stop, restart, or deploy any other project. Shared-server inspection is limited to service names, listening ports, domains, and container status needed to prevent collisions. Never inspect another project's source, database, environment, logs, credentials, or business data.
- Never read or print `.env`, private keys, tokens, database dumps, or production credentials. Verify secret presence or permissions without exposing values.

## Change workflow

For every non-trivial change:

1. Reproduce or define the expected behavior.
2. Write a concise implementation plan with risks and rollback.
3. Create a dedicated branch or isolated worktree; do not work directly on `main`.
4. For behavior changes and bug fixes, follow RED-GREEN-REFACTOR: add the failing test first, confirm the expected failure, implement the minimum fix, then refactor.
5. Run the relevant focused tests while iterating.
6. Before review, run the complete quality gate:
   - `pnpm install --frozen-lockfile`
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm test`
   - `pnpm test:infra`
   - `pnpm build`
   - `git diff --check`
7. Run a static security/secret scan over added lines and tracked files.
8. Obtain an independent review from a different capable model/provider when available. The implementer must not be the sole reviewer. Security concerns and logic errors are blocking.
9. Open a PR using the repository template. Merge only after CI is green and review findings are resolved.
10. Deploy only the merged `main` commit using `./deploy.sh`, then verify API, web, Nginx, containers, and the deployed SHA or source hash.

Direct pushes to `main` are forbidden except for an explicitly authorized emergency. Emergency changes still require tests, review, and a follow-up PR or documented audit.

## Model orchestration

- Choose models by task capability, not vendor loyalty: strongest reasoning for architecture/debugging, coding-specialized agents for implementation, fast models for mechanical checks, and an independent provider/model for review.
- Keep at least two provider fallbacks available. A provider failure must trigger fallback rather than bypassing tests or review.
- Use isolated worktrees for parallel implementation agents. Never allow two writing agents to share the same working tree.
- Model output is advisory until deterministic tests and repository evidence verify it.

## Architecture rules

- Business logic belongs in `@bowling/shared`; API, web, and mobile are delivery channels.
- tRPC is the API contract. Zod schemas define boundaries and inferred types.
- Domain-core edge cases require unit tests; production bugs require a regression test first.
- Keep commits atomic and use Conventional Commits.
- Do not add dependencies without checking the existing manifests, lockfile impact, maintenance status, and security implications.

## Production safety

- Production domain: `bolos.mogambo.xyz`.
- Bowling-only bindings: API `127.0.0.1:3001`, web `127.0.0.1:3103`.
- Do not reuse or change another project's port, Nginx site, directory, container, volume, or process.
- Production secrets remain only in `/opt/bowling-tournaments/.env`. Normal deploys must preserve them; never generate or rotate them on each deploy.
- Every deploy must acquire the bowling deploy lock, validate Compose, back up PostgreSQL, build before replacement, apply schema deliberately, pass health checks, and retain an application-image rollback path.
- Production schema changes use committed Drizzle migrations. `drizzle-kit push` is forbidden in routine production deploys; the existing pre-journal database may use the reviewed one-time baseline only.
- After that baseline, migrations `0000` through `0002` are immutable; every later schema change must add a new migration.
- Do not delete the PostgreSQL volume or restore a database dump without explicit authorization.
- TLS may be enabled only after DNS for `bolos.mogambo.xyz` resolves to the intended server and the HTTP route passes its health check.
- The first deploy installs the Nginx site. Later deploys must preserve the server copy because Certbot manages TLS there; routing changes require an explicit reviewed Nginx update.
