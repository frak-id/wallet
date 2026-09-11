/**
 * Fails when `packages/wallet-shared/src/types/i18n/resources.d.ts` has drifted from
 * the EN locale it is generated from: the generated literals are values rather than
 * key constraints, so an unregenerated `translation.json` edit type-checks clean.
 * Regenerate with `bun run --cwd packages/wallet-shared i18n:types`.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const PACKAGE = join(ROOT, "packages/wallet-shared");
const GENERATED = join(PACKAGE, "src/types/i18n/resources.d.ts");

const scratch = mkdtempSync(join(tmpdir(), "ce-i18n-types-"));
const candidate = join(scratch, "resources.d.ts");

try {
    execFileSync(
        "bun",
        [
            "run",
            "i18next-resources-for-ts",
            "interface",
            "-i",
            "./src/i18n/locales/en/",
            "-o",
            candidate,
        ],
        { cwd: PACKAGE, stdio: "pipe" }
    );

    if (readFileSync(GENERATED, "utf8") === readFileSync(candidate, "utf8")) {
        console.log("✅ i18n types match the EN locale");
    } else {
        console.error(
            "❌ src/types/i18n/resources.d.ts is stale.\n" +
                "   Run: bun run --cwd packages/wallet-shared i18n:types"
        );
        process.exit(1);
    }
} catch (error) {
    if (error instanceof Error && "status" in error) {
        const detail = "stderr" in error ? String(error.stderr) : error.message;
        console.error(`i18n type generation failed:\n${detail}`);
        process.exit(1);
    }
    throw error;
} finally {
    rmSync(scratch, { recursive: true, force: true });
}
