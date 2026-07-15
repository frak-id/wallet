# services/shopify-bootstrap — Compass

One-shot orchestrator that runs before the Shopify app can serve traffic. Packaged as a Bun image and deployed as a K8s `Job` (`infra/gcp/shopify.ts` → `shopifyBootstrapJob`); the Shopify `KubernetesService` declares `dependsOn: [shopifyBootstrapJob]`. Exists because Shopify moved off its standalone public Postgres onto the in-cluster GCP Postgres (per-stage split).

## Steps (sequential, fail-fast)
1. **Schema migrations** (`src/migrate-schema.ts`) — Drizzle migrations against the target (GCP) Postgres via `drizzle-orm/postgres-js/migrator`. STAGE-routed to `./drizzle/{dev,prod}` (SQL owned by `apps/shopify`, copied into the image).
2. **Data migration** (`src/migrate-data.ts`) — one-time copy of `session` + `purchase` rows from the legacy public Postgres. Idempotent (`ON CONFLICT (id) DO NOTHING`); the `purchase` serial sequence is reset after. Skipped entirely when `SHOPIFY_SOURCE_POSTGRES_HOST` is unset (post-cutover no-op).

## Quick Commands
```bash
bun -F @frak-labs/shopify-bootstrap start    # Run the orchestrator from source
bun -F @frak-labs/shopify-bootstrap build    # Bundle to dist/index.js (Docker image)
```

## Required Env
- `STAGE` — migration folder routing (`production` → prod, else dev)
- Target (GCP): `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- Source (legacy, optional): `SHOPIFY_SOURCE_POSTGRES_HOST`, `SHOPIFY_SOURCE_POSTGRES_PORT`, `SHOPIFY_SOURCE_POSTGRES_DB`, `SHOPIFY_SOURCE_POSTGRES_USER`, `SHOPIFY_SOURCE_POSTGRES_PASSWORD` — data step is skipped without the host.

## Non-Obvious Patterns
- **Schema/migrations live in `apps/shopify`** — this service only ships the `.sql` output (`apps/shopify/drizzle/{dev,prod}`) copied by the Dockerfile. Never generate migrations here; regenerate them in `apps/shopify` (`bun -F @frak-labs/shopify-app db:generate`).
- **Data copy is raw SQL** — uses `postgres.js` (`SELECT *` → batched `INSERT ... ON CONFLICT DO NOTHING`); no Drizzle schema import needed. Column keys already match the camelCase DB identifiers.
- **Image is one-shot** — failures crash the Job (`restartPolicy: OnFailure`) and block the Shopify rollout (intentional).
- **Cutover cleanup** — once migrated, drop the `SHOPIFY_SOURCE_*` env and decommission the legacy public Postgres instance.

## See Also
Parent `/AGENTS.md` · `services/bootstrap/AGENTS.md` (the backend analog) · `apps/shopify/AGENTS.md` (schema owner) · `infra/gcp/shopify.ts` (Job wiring) · `apps/shopify/db/schema/{sessionTable,purchaseTable}.ts`.
