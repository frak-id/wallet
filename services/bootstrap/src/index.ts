import { ensureBuckets } from "./ensure-buckets";
import { runLibsqlMigrations } from "./migrate-libsql";
import { runPgMigrations } from "./migrate-pg";

/**
 * One-shot bootstrap entry point. Runs sequentially and fails fast.
 *
 * Steps:
 *   1. Postgres Drizzle migrations
 *   2. libSQL Drizzle migrations (auth/WebAuthn)
 *   3. RustFS bucket provisioning (idempotent)
 */
async function main(): Promise<void> {
    console.log("[bootstrap] Starting");

    await runPgMigrations();
    await runLibsqlMigrations();
    await ensureBuckets();

    console.log("[bootstrap] All steps complete");
}

main().catch((error) => {
    console.error("[bootstrap] Failed:", error);
    process.exit(1);
});
