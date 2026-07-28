/**
 * Guard test: the CDN/browser bundle must never pull in the backend-only
 * `identity/verify` module (nor the `identity/index` barrel that
 * re-exports whatever `sign.ts` adds later), because `verify.ts` is meant
 * to stay unreachable from the browser bundle (README §2.3, DECISIONS §2.1).
 *
 * Browser code imports `identity/canonical` and `identity/sign` by *deep
 * path* — never the barrel. This test greps import specifiers rather than
 * building the bundle, so it stays fast and has no bundler dependency; it
 * is intentionally conservative (a regex, not a type-checker) and should be
 * read as a tripwire, not a proof of tree-shaking.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SDK_ROOT = join(import.meta.dirname, "../..");

const FORBIDDEN_IMPORT_RE = /from\s+["'][^"']*identity\/(verify|index)["']/;
// Also forbid a bare `../identity"` / `./identity"` barrel import (resolves
// to identity/index.ts via the directory's index.ts).
const FORBIDDEN_BARE_BARREL_RE = /from\s+["'][^"']*\/identity["']/;

const BROWSER_DIRS = ["src/config", "src/clients", "src/actions", "src/utils"];
const BROWSER_ENTRY_FILES = ["src/bundle.ts"];

function listTsFiles(dir: string): string[] {
    const entries = readdirSync(dir);
    const files: string[] = [];
    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            files.push(...listTsFiles(fullPath));
        } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
            files.push(fullPath);
        }
    }
    return files;
}

describe("identity bundle isolation", () => {
    it("no browser-path file imports identity/verify or the identity barrel", () => {
        const files = [
            ...BROWSER_DIRS.flatMap((dir) => listTsFiles(join(SDK_ROOT, dir))),
            ...BROWSER_ENTRY_FILES.map((file) => join(SDK_ROOT, file)),
        ];

        const offenders: string[] = [];
        for (const file of files) {
            const contents = readFileSync(file, "utf8");
            if (
                FORBIDDEN_IMPORT_RE.test(contents) ||
                FORBIDDEN_BARE_BARREL_RE.test(contents)
            ) {
                offenders.push(file);
            }
        }

        expect(offenders).toEqual([]);
    });

    it("sign.ts (once it exists) must never import verify.ts", () => {
        const signPath = join(SDK_ROOT, "src/identity/sign.ts");
        let contents: string;
        try {
            contents = readFileSync(signPath, "utf8");
        } catch {
            // sign.ts lands in a later commit (Phase 2) — nothing to check yet.
            return;
        }
        expect(contents).not.toMatch(/from\s+["'][^"']*verify["']/);
    });
});
