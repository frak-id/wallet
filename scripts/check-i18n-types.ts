/**
 * Fails when `packages/wallet-shared/src/types/i18n/resources.d.ts` has drifted
 * from the EN locale it is generated from.
 *
 * The generator reads the EN locale only, and the generated literals are values
 * rather than key constraints, so an edit to `translation.json` without a regen
 * type-checks clean and drifts silently.
 *
 * Coverage is narrower than the name suggests: the generator resolves the JSON
 * namespace but fails to load the `.ts` locale modules (`index`, `listener`,
 * `standalone`), so keys defined only in those are outside this gate. It writes
 * to a temp path and compares, so the working tree is never touched.
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
