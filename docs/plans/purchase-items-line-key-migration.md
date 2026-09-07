# Migration — `purchase_items` line key + `total_price`

**Owner:** DB team · **Requested:** 2026-09-04 · **Branch:** `chore/audit-findings`
**Blocks:** deploying the backend from this branch to `prod`. The application code writes
`purchase_items.total_price` and uses `purchase_items_line_idx` as its `ON CONFLICT` arbiter, so the
backend will fail at runtime against a database that has not taken this change.

## What ships where

The schema change (`services/backend/src/domain/purchases/db/schema.ts`) and the `local`
(`drizzle/local/0040_chubby_calypso.sql`) and `dev` (`drizzle/dev/0044_typical_alex_wilder.sql`)
migrations ship in this branch. **`prod` does not**: `services/bootstrap/AGENTS.md` keeps migration
generation staged per environment (`db:generate:prod` against its own `.env.prod`), and the prod
snapshot carries unrelated drift that needs its own decision (below). Nothing in CI blocks a `main`
merge on the missing prod file.

## What the schema now declares

```ts
// services/backend/src/domain/purchases/db/schema.ts
totalPrice: decimal("total_price"),            // nullable
unique("purchase_items_line_idx")
    .on(table.purchaseId, table.externalId, table.sku)
    .nullsNotDistinct(),
// the old uniqueIndex("purchase_items_external_id_idx") on (external_id, purchase_id) is gone
```

`drizzle-kit generate` against that schema produced the following; it is what the `dev` and `local`
files contain, and what the `prod` generation should produce once the drift below is handled:

```sql
DROP INDEX "purchase_items_external_id_idx";--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "total_price" numeric;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_line_idx" UNIQUE NULLS NOT DISTINCT("purchase_id","external_id","sku");
```

## Why each statement

- **`total_price`** — the amount actually paid for a line: post-discount, tax-inclusive, shipping
  excluded. Nullable on purpose; existing rows keep working because every read falls back to
  `price * quantity`. Without it the two claim paths cannot agree on a matched-items reward basis.
- **The new unique constraint** — item identity must include `sku`, otherwise two variants of one
  product (same parent `product_id`, different SKU) collide and one line is silently dropped. That is
  the canonical cart for product-scoped campaigns.
- **`NULLS NOT DISTINCT`** — without it, two sku-less lines of the same product would be treated as
  distinct and a webhook redelivery would insert duplicate rows on every delivery. Requires
  PostgreSQL 15+; the target is 17.

## Safety notes

- **Existing rows cannot violate the new constraint.** The dropped index was unique on
  `(external_id, purchase_id)` — at most one row per `(purchase, product)`. Adding `sku` to the key is
  strictly weaker, and `NULLS NOT DISTINCT` only makes the sku-less subset as strict as the old index,
  never stricter. No dedupe backfill is needed.
- **No backfill of `total_price`.** Reads fall back to `price * quantity` for rows written before this.
- **Lock window.** `ADD CONSTRAINT ... UNIQUE` builds its index under `ACCESS EXCLUSIVE` with a full
  scan. The migration `KubernetesJob` blocks the backend rollout, so this is a deploy-window stall
  proportional to `purchase_items` size — worth sizing against prod row count before the prod step.

## Known landmine, independent of this change

**The `prod` snapshot lags `schema.ts`.** A `db:generate` against prod sweeps in unrelated pending
drift — `install_codes` columns, an `install_codes` check constraint, and a `purchase_claims` index —
none of which belongs to this work. Expect it, and decide separately whether that drift should land.
`dev` and `local` did not show it.

## Rollout

1. `local` — shipped; apply, run the backend suite against it.
2. `dev` — shipped; apply, deploy this branch's backend, QA validates.
3. `prod` — generate only after QA signs off on dev, handling the snapshot drift above.

The backend must not be deployed to a stage ahead of its migration.

## Verification without a database

`services/backend/src/domain/purchases/repositories/PurchaseRepository.test.ts` asserts the rendered
SQL of the insert path (single arbiter, no `targetWhere`, fill-only `coalesce` set clause) and the
reconciliation/backfill statements. It cannot catch a DDL mismatch — that is what step 1 is for.
