-- DB2 — owed by the DB team, not shipped from this repo.
--
-- Apply to `local`, `dev` AND `prod` before the backend image that names
-- `checkout_token` is deployed: without it every install-code/generate and
-- every install-code/resolve raises 42703, both arms, not only the new one.
-- Re-adding NOT NULL fails once one deferred row exists.

ALTER TABLE install_codes ALTER COLUMN anonymous_id DROP NOT NULL;

ALTER TABLE install_codes ADD COLUMN IF NOT EXISTS checkout_token text;

CREATE INDEX IF NOT EXISTS install_codes_merchant_checkout_token_idx
    ON install_codes (merchant_id, checkout_token);

CREATE INDEX IF NOT EXISTS purchase_claims_merchant_token_idx
    ON purchase_claims (merchant_id, purchase_token);

-- Split so the ADD takes no full-table scan under its ACCESS EXCLUSIVE lock;
-- VALIDATE then scans under a weaker one.
ALTER TABLE install_codes ADD CONSTRAINT install_codes_credential_present
    CHECK ("anonymous_id" IS NOT NULL OR "checkout_token" IS NOT NULL) NOT VALID;

ALTER TABLE install_codes VALIDATE CONSTRAINT install_codes_credential_present;
