# Migration request — `purchase_items` line key + `total_price`

**Owner:** DB team · **Requested:** 2026-09-04 · **Branch:** `chore/audit-findings`
**Blocks:** deploying the backend from this branch. The application code in this branch writes
`purchase_items.total_price` and uses `purchase_items_line_idx` as its `ON CONFLICT` arbiter, so the
backend will fail at runtime against a database that has not taken this change.

## Why this exists as a request instead of a migration

The schema change (`services/backend/src/domain/purchases/db/schema.ts`) ships in this branch. The
migrations do **not**: `services/bootstrap/AGENTS.md` states migrations are human-generated and owned
by the DB team, and generation is staged per environment (`db:generate:local` / `:dev` / `:prod`,
each against its own `.env.*`). Generate them in your own rollout order.

## What the schema now declares

```ts
// services/backend/src/domain/purchases/db/schema.ts
totalPrice: decimal("total_price"),            // nullable
unique("purchase_items_line_idx")
    .on(table.purchaseId, table.externalId, table.sku)
    .nullsNotDistinct(),
// the old uniqueIndex("purchase_items_external_id_idx") on (external_id, purchase_id) is gone
```

`drizzle-kit generate` against that schema produced the following on a `dev`-shaped snapshot. It is
reproduced here as a **reference for diffing your own output**, not as something to apply:

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

1. `local` — generate, apply, run the backend suite against it.
2. `dev` — generate, apply, deploy this branch's backend, QA validates.
3. `prod` — generate only after QA signs off on dev, handling the snapshot drift above.

The backend must not be deployed to a stage ahead of its migration.

## Verification without a database

`services/backend/src/domain/purchases/repositories/PurchaseRepository.test.ts` asserts the rendered
SQL of the insert path (single arbiter, no `targetWhere`, fill-only `coalesce` set clause) and the
reconciliation/backfill statements. It cannot catch a DDL mismatch — that is what step 1 is for.
