# Account security release plan

## Objective

Make public account onboarding recoverable and abuse-resistant without breaking existing users or weakening the PostgreSQL email outbox.

## Invariants

- Existing credentialed users remain verified and existing version-0 JWTs remain valid.
- New users cannot receive an authenticated session until their email is verified.
- Verification and reset tokens are 256-bit random values; only SHA-256 hashes are stored in `auth_tokens`.
- Raw action links are encrypted with AES-256-GCM before entering the durable outbox. The encryption key is derived from the existing JWT secret with domain separation.
- Tokens are single-use, expire, and are consumed atomically with the credential change.
- Password reset increments `authVersion`, immediately invalidating older JWTs.
- Forgot-password, resend-verification, and duplicate-signup responses do not reveal whether an account exists.
- Rate-limit keys are HMACs of action/IP/normalized email; PostgreSQL stores no raw IP or email in the limiter table.
- No Redis or new external infrastructure.
- Provider acceptance is `sent`, never `delivered`.

## Schema and migration

Add migration `0007`:

- `user_credentials.emailVerifiedAt timestamptz NULL DEFAULT now()`, backfilled for all existing credentials. The default keeps inserts from the old API verified during a rolling deploy; the new API explicitly writes `NULL` for new signups.
- `user_credentials.authVersion integer NOT NULL DEFAULT 0`.
- `auth_tokens`: profile FK, token hash, type, expiry, used timestamp, audit timestamps and indexes.
- `auth_rate_limits`: opaque HMAC key, action, atomic counter and window expiry.

## API contract

- `signup`: normalize email; create unverified account transactionally; queue encrypted verification link; return only `{ requiresVerification: true }`. Duplicate requests return the same shape and may resend only for an unverified account.
- `verifyEmail`: atomically consume a valid token, mark credentials verified, queue idempotent welcome email, and return success without creating a session.
- `resendVerification`: generic response; queue a fresh link only for an unverified account.
- `login`: require correct password and verified email; return JWT carrying `authVersion`.
- `forgotPassword`: generic response; queue a reset link only for a verified account.
- `resetPassword`: atomically consume token, replace bcrypt hash, increment `authVersion`, and invalidate other outstanding reset tokens.
- Request context validates JWT signature, verification state, and current `authVersion`.

## Abuse controls

Use atomic PostgreSQL windows keyed by HMAC:

- Signup: per IP and per email.
- Login: 30 attempts per IP and 5 per IP+email per 15 minutes; clear the account-specific window after a successful login.
- Forgot password and verification resend: per IP and per email.
- Token consumption: per IP.
- Organizer announcements: 5 distinct sends per organizer/organization/tournament per 10 minutes and at most 500 recipients; idempotent retries do not consume quota.
- Limiter rows expired for more than 24 hours are purged opportunistically through the indexed expiry column.

Fastify trusts exactly one reverse-proxy hop so `req.ip` resolves the Nginx client address rather than a spoofed left-most forwarded value.

## Web and E2E

- Signup confirmation state instead of storing a JWT.
- `/verify-email`, `/forgot-password`, and `/reset-password` pages.
- Login link for forgotten password and actionable unverified-account message.
- Critical E2E: signup → read encrypted-link payload through test helper/decryptor → verify → login; forgot → reset → old JWT rejected → new password accepted.

## Verification gates

Focused RED/GREEN tests, migration check, full API/shared/infra tests, critical Playwright E2E, frozen install, typecheck, lint, build, production-target dependency audit, secret scan, independent security review, PR and all CI checks.

## Rollout

1. Production backup and standard deploy of merged `main`.
2. Migration backfills existing credentials as verified.
3. Verify API/web/PostgreSQL health and schema.
4. Synthetic production flow using a Resend test recipient; verify provider acceptance and remove all synthetic rows.
5. Confirm no unexpected outbox backlog.

## Rollback

Application rollback images remain available. The migration is additive; old code ignores new columns/tables. Do not drop schema during rollback. Keep the additive migration and restore the previous API/web images if the smoke fails. Because the old API does not enforce verification, pause public signup during a prolonged rollback until the secured API is restored.
