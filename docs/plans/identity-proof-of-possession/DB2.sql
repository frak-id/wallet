-- DB2 — owed by the DB team, not shipped from this repo.
--
-- Two tiers. Only tier 1 blocks the deploy, and both of its statements are
-- catalog-only: no table rewrite, no scan, lock held for microseconds even on a
-- large table. Tier 2 is performance and defence-in-depth and can land any time
-- after, online.
--
-- Skipping tier 1 is not an option: the backend selects `install_codes` with a
-- full column list, so a database without `checkout_token` raises 42703 on
-- EVERY install-code/generate and install-code/resolve — both arms, not only
-- the new one.

-- ── Tier 1 — before the backend image. Two statements, both instant. ────────

-- Metadata-only in PG11+: a nullable column with no default rewrites nothing.
ALTER TABLE install_codes ADD COLUMN IF NOT EXISTS checkout_token text;

-- Catalog flag flip, no scan. Must precede the first deferred (token-only) row.
-- Re-adding NOT NULL later fails once one such row exists.
ALTER TABLE install_codes ALTER COLUMN anonymous_id DROP NOT NULL;

-- ── Tier 2 — any time after, online. Nothing breaks while it is missing. ────

-- Serves the reuse CTE's `merchant_id = $1 AND checkout_token = $2`. Without it
-- that arm degrades to a merchant-prefix scan; `install_codes` is pruned on a
-- 72h TTL, so the table is small and the degradation is survivable.
CREATE INDEX CONCURRENTLY IF NOT EXISTS install_codes_merchant_checkout_token_idx
    ON install_codes (merchant_id, checkout_token);

-- Serves `findByMerchantAndToken`. `purchase_claims_unique_purchase` cannot:
-- it is (merchant_id, order_id, purchase_token) and this lookup leaves the
-- middle column unconstrained. This table is NOT pruned, so it matters more
-- than the one above.
CREATE INDEX CONCURRENTLY IF NOT EXISTS purchase_claims_merchant_token_idx
    ON purchase_claims (merchant_id, purchase_token);

-- Defence in depth only — the route schema already refuses a call carrying
-- neither credential. Split so the ADD takes no scan under ACCESS EXCLUSIVE;
-- VALIDATE then scans under a weaker lock.
ALTER TABLE install_codes ADD CONSTRAINT install_codes_credential_present
    CHECK ("anonymous_id" IS NOT NULL OR "checkout_token" IS NOT NULL) NOT VALID;

ALTER TABLE install_codes VALIDATE CONSTRAINT install_codes_credential_present;
