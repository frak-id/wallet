import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Fail when a spec body's only assertion is a screenshot.
 *
 * `ignoreSnapshots` is on unless `LIGHT_SNAPSHOTS` is set, so such a test
 * asserts nothing on a default run — the defect that let a tablet-cascade bug
 * survive a test named for it.
 *
 * Takes spec filenames; without them it checks every spec. `pages.check.ts`
 * predates this rule and is screenshot-only throughout, so CI passes the two
 * it actually runs rather than blocking on a suite it does not.
 */
const SPECS = `${dirname(fileURLToPath(import.meta.url))}/specs`;
const SELECTED = process.argv.slice(2);
const TEST_START = /^\s{4}test\(/;
// A `toHaveScreenshot` expect is still a screenshot: skipped by default, so it
// proves nothing here. A `waitFor` states a precondition rather than asserting
// what rendered, so neither counts.
const SCREENSHOT_EXPECT =
    /await\s+expect\([^)]*\)\s*\.toHaveScreenshot\([^;]*;/g;
const REAL_ASSERTION = /\bexpect\b/;

function bodiesOf(source: string): { name: string; body: string }[] {
    const lines = source.split("\n");
    const out: { name: string; body: string }[] = [];

    for (const [index, line] of lines.entries()) {
        if (!TEST_START.test(line)) continue;
        // Until the next same-indent `test(` or the end of the file.
        const rest = lines.slice(index + 1);
        const end = rest.findIndex((l) => TEST_START.test(l));
        out.push({
            name: line.trim().slice(0, 60),
            body: (end === -1 ? rest : rest.slice(0, end)).join("\n"),
        });
    }
    return out;
}

const failures: string[] = [];
const all = readdirSync(SPECS).filter((f) => f.endsWith(".check.ts"));
for (const file of SELECTED.length > 0 ? SELECTED : all) {
    const source = readFileSync(join(SPECS, file), "utf8");
    for (const { name, body } of bodiesOf(source)) {
        const withoutPixels = body.replace(SCREENSHOT_EXPECT, "");
        if (!REAL_ASSERTION.test(withoutPixels)) {
            failures.push(`${file}  ${name}`);
        }
    }
}

if (failures.length > 0) {
    console.error("Specs whose only assertion is a screenshot:");
    for (const entry of failures) console.error(`  ${entry}`);
    console.error(
        "\nScreenshots are skipped unless LIGHT_SNAPSHOTS is set, so these prove nothing on a default run."
    );
    process.exit(1);
}
console.log(
    "✅ every light spec carries an assertion that runs without pixels"
);
