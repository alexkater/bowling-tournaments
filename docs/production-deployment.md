# Production deployment

This document is the canonical production runbook for Strike Manager / Bowling Tournaments.

## Scope

- Repository: `alexkater/bowling-tournaments`
- Server: `nest_deploy` (`178.104.71.198`)
- Deployment directory: `/opt/bowling-tournaments`
- Public domain: `bolos.mogambo.xyz`
- API binding: `127.0.0.1:3001`
- Web binding: `127.0.0.1:3103`

Do not inspect or modify another project's source, environment, data, logs, process, container, Nginx site, port, or volume. Shared-server inspection is limited to names, domains, listening ports, and container status required to avoid collisions.

## Release requirements

A production release must come from a clean local `main` whose SHA exactly matches `origin/main`. Direct deployment of feature branches is blocked by `deploy.sh`.

Before merge, the pull request must have:

1. A written implementation plan, risks, and rollback notes.
2. Regression tests first for behavior changes or bug fixes.
3. The complete quality gate from `AGENTS.md`.
4. A secret/security scan.
5. Independent review by a different capable model/provider when available.
6. Green CI and production-image workflows.

## Normal deploy

From the canonical workspace:

```bash
git switch main
git pull --ff-only
./deploy.sh
```

The existing pre-journal installation requires one reviewed, one-time baseline:

```bash
./deploy.sh --baseline-migrations
```

That flag is accepted only by the fixed bowling deploy scripts. After the database backup and production-image build, it verifies the exact tables and named foreign-key/unique constraints expected through migration `0001`, runs the idempotent organizer backfill, and records hashes for `0000` and `0001` in one transaction. The normal migration step then applies pending migration `0002`. It refuses any schema mismatch or already-populated journal. Do not use the flag again after the journal exists.

`deploy.sh` verifies the branch, clean working tree, and remote SHA before it contacts production. It synchronizes reviewed source while excluding `.env`, Git metadata, dependencies, logs, test output, and build artifacts.

The server-side deploy then:

1. Acquires `/var/lock/bowling-tournaments-deploy.lock`.
2. Verifies required commands and checks bowling's ports for collisions.
3. Preserves or initializes `/opt/bowling-tournaments/.env` with mode `0600`; existing secrets are never rotated.
4. Validates the Compose model.
5. Creates a timestamped PostgreSQL dump in `/opt/backups/bowling-tournaments`.
6. Tags current application images for rollback.
7. Builds API and web images before replacing containers.
8. Applies reviewed Drizzle migrations with the lockfile-installed `drizzle-kit`; it never uses `push` during a routine production deploy.
9. Starts the stack and waits for API and web health checks.
10. Installs the Nginx site only when it does not exist, validates Nginx, and reloads it.

On failure after the build begins, the script restores the previous application-image tags. It does not automatically restore the database; database restoration is destructive and requires explicit authorization.

## DNS and TLS

Create an A record:

```text
bolos.mogambo.xyz -> 178.104.71.198
```

The first deploy installs an HTTP virtual host. Before requesting a certificate, verify DNS and HTTP routing:

```bash
dig +short bolos.mogambo.xyz A
curl --resolve bolos.mogambo.xyz:80:178.104.71.198 \
  http://bolos.mogambo.xyz/
```

Only after both checks succeed, enable TLS on the server:

```bash
certbot --nginx -d bolos.mogambo.xyz
curl --fail --show-error https://bolos.mogambo.xyz/
```

Certbot owns the installed Nginx site after this point. Routine deploys preserve that server-side file so they cannot remove TLS. Any routing change requires an explicit reviewed Nginx update.

## Verification

Use only bowling-scoped commands:

```bash
cd /opt/bowling-tournaments
docker compose -f docker-compose.prod.yml ps
curl --fail --show-error http://127.0.0.1:3001/health
curl --fail --show-error http://127.0.0.1:3103/
curl --fail --show-error https://bolos.mogambo.xyz/
```

Verify that the running source or release identifier matches the merged `main` SHA recorded for the deployment. Never print `.env` or inspect another stack while diagnosing a collision.

## Rollback

The deploy log records the PostgreSQL backup path and rollback image tags. If an automatic application-image rollback is insufficient:

1. Stop and diagnose only the bowling stack.
2. Select the last known-good bowling application images.
3. Recreate only the `api` and `web` services.
4. Verify API, web, Nginx, and domain health.

Do not delete the PostgreSQL volume. Do not restore a dump without explicit authorization and a documented recovery plan.
