import { runDataMigration } from "./migrate-data";
import { runSchemaMigrations } from "./migrate-schema";

/**
 * One-shot Shopify bootstrap entry point. Runs sequentially and fails fast.
 *
 * Steps:
 *   1. Apply Drizzle schema migrations to the target (GCP) Postgres.
 *   2. Copy existing `session` + `purchase` rows from the old public Postgres
 *      (idempotent; no-op once the source env is removed post-cutover).
 *
 * Wired as a K8s Job in infra/gcp/shopify.ts; the Shopify Service declares
 * `dependsOn` the Job so it never serves traffic against an unmigrated DB.
 */
async function main(): Promise<void> {
    console.log("[shopify-bootstrap] Starting");

    await runSchemaMigrations();
    await runDataMigration();

    console.log("[shopify-bootstrap] All steps complete");
}

main().catch((error) => {
    console.error("[shopify-bootstrap] Failed:", error);
    process.exit(1);
});
