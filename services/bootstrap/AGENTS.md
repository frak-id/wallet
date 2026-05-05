# services/bootstrap — Compass

One-shot orchestrator that runs before the backend can serve traffic. Packaged as a Bun image and deployed as a K8s `Job` (`infra/gcp/backend.ts` → `bootstrapJob`); backend `KubernetesService` declares `dependsOn: [bootstrapJob]`.

## Steps (sequential, fail-fast)
1. **Postgres Drizzle migrations** (`src/migrate-pg.ts`) — programmatic via `drizzle-orm/postgres-js/migrator`. Resolves the migrations folder + tracking table the same way `drizzle.config.ts` does (local / `_v2` / prod / dev).
2. **libSQL Drizzle migrations** (`src/migrate-libsql.ts`) — WebAuthn auth schema. Skipped if `LIBSQL_URL` is unset.
3. **RustFS bucket provisioning** (`src/ensure-buckets.ts`) — creates `images-${STAGE}` with public-read policy via `@aws-sdk/client-s3` (Bun.s3 has no bucket-level ops). Idempotent. Skipped if `RUSTFS_ENDPOINT` is unset.

## Quick Commands
```bash
bun -F @frak-labs/bootstrap start                 # Run the orchestrator (all steps)
bun -F @frak-labs/bootstrap db:generate           # Generate Postgres migration
bun -F @frak-labs/bootstrap db:migrate            # Apply Postgres migrations only
bun -F @frak-labs/bootstrap db:studio             # Drizzle Studio (Postgres)
bun -F @frak-labs/bootstrap db:generate:libsql    # Generate libSQL (auth) migration
bun -F @frak-labs/bootstrap db:migrate:libsql     # Apply libSQL migrations only
```

## Required Env
- `STAGE` — used for migration folder routing + bucket naming
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_SCHEMA`
- `LIBSQL_URL` — optional, libSQL step is skipped without it
- `RUSTFS_ENDPOINT`, `RUSTFS_ACCESS_KEY`, `RUSTFS_SECRET_KEY` — optional, bucket step is skipped without them

## Non-Obvious Patterns
- **Drizzle schemas live in `services/backend/`** — `drizzle.config.ts` here references them via `../backend/src/domain/*/db/schema.ts`. Migration generation reads from there; runtime migration only needs the SQL files in `./drizzle/`.
- **DB migrations are human-generated** — never auto-generate; the DB team owns this.
- **Image is one-shot** — no reverse dependencies. Failures crash the Job and block backend rollout (intentional).

## See Also
Parent `/AGENTS.md` · `services/backend/AGENTS.md` · `infra/AGENTS.md` (bootstrap Job wiring) · `infra/gcp/backend.ts` · `infra/gcp/secrets.ts` (`bootstrapEnv`).
