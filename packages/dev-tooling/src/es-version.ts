// Load-bearing, not redundant: consuming apps compile this file through their
// own tsconfig, whose `include` does not cover this package's `src`. Without
// the reference the lazy `es-check` import is an implicit `any` in every
// consumer.
/// <reference path="./es-check.d.ts" />
import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * The supported browser floor for every wallet-facing bundle.
 *
 * Derived 2026-08-26 from OpenPanel: `browser is Safari` + `origin is
 * https://wallet.frak.id`, range `Last 12 months`, reading the full Browser
 * Version distribution via the search box. 205 sessions sit at 15.4-15.6.8,
 * 17 below 15.4, 2 at 14.x. A 15.4 floor covers the 205 and needs no
 * polyfill: 15.4 is exactly where `Object.hasOwn` and `Array.prototype.at`
 * shipped.
 *
 * When re-deriving, read the FULL version list, not the top-15 ranking — the
 * tail is the whole decision, and searching for "14" also matches "17.14".
 *
 * Pinned rather than `baseline-widely-available` because that alias moves:
 * it was safari16 under vite 7 and is safari16.4 under vite 8, and it changed
 * once already inside an unrelated bundler migration.
 */
export const BROWSER_TARGET_SAFARI = "safari15.4";

/**
 * The ECMAScript floor matching the browser target, for the emitted-output
 * gate. Every ES2022 stdlib API is available at Safari 15.4; ES2023 methods
 * (`toSorted`, `toReversed`, `with`) are Safari 16 and stay out.
 *
 * Lives here rather than beside the vite plugin because two enforcement paths
 * read it: the vite `writeBundle` gate and the standalone post-build check
 * over the tsdown packages, which must not import vite.
 */
export const BROWSER_TARGET_ECMA = "es2022";

export type AssertEsVersionOptions = {
    /** Directory whose `.js` files are checked, recursively. */
    root: string;
    /**
     * Whether a violation throws. Defaults to `true`. `false` logs the
     * offending files and continues.
     */
    enforce?: boolean;
    /**
     * A scoped exemption. Both halves are required together, so an exemption
     * can never silently apply bundle-wide: `features` is the comma-separated
     * es-check feature list (a string, not an array), and `in` is a substring
     * matching the chunks it applies to, e.g. `"ui-vendor"`.
     *
     * Detection is property-NAME matching with no receiver analysis, so a
     * library class defining its own `toSorted`/`at`/`replaceAll` method is
     * reported as if it called the Array or String builtin. Only exempt a
     * name after reading the emitted chunk and confirming the receiver is not
     * the builtin.
     */
    ignore?: { features: string; in: string };
};

/**
 * Nothing was inspected — missing, unreadable, or empty directory. Typed so a
 * caller can route it to the opposite remedy from a floor violation without
 * matching message text across a module boundary.
 */
export class NothingScannedError extends Error {}

/**
 * Every emitted `.js`, `.cjs`, and `.mjs` under `root`, recursively.
 *
 * Throws rather than returning empty: a missing directory means a
 * misconfigured root, and a gate that passes silently on zero files is
 * worse than no gate.
 */
async function collectEmittedJs(root: string): Promise<string[]> {
    let entries: Dirent[];
    try {
        entries = await fs.readdir(root, {
            recursive: true,
            withFileTypes: true,
        });
    } catch (error) {
        throw new NothingScannedError(
            `[es-version] cannot read ${root} — check the configured output root (${error instanceof Error ? error.message : String(error)})`
        );
    }

    const files = entries
        .filter((entry) => entry.isFile() && /\.(?:c|m)?js$/.test(entry.name))
        .map((entry) => path.join(entry.parentPath, entry.name));

    if (files.length === 0) {
        throw new NothingScannedError(
            `[es-version] no JS found under ${root} — nothing was checked`
        );
    }
    return files;
}

/**
 * Reject emitted chunks using syntax or stdlib APIs above the floor. The only
 * layer that sees what ships: `lib` cannot reject an ambient augmentation,
 * `skipLibCheck` hides dependency `.d.ts`, and the bundler lowers what it can
 * but emits the rest verbatim — `using` survives a `safari15.4` target.
 */
export async function assertEsVersion({
    root,
    enforce = true,
    ignore,
}: AssertEsVersionOptions): Promise<void> {
    const files = await collectEmittedJs(root);

    // The exemption applies only to the chunks it names, so a genuine
    // builtin call anywhere else still fails.
    const exempt = new Set(
        ignore ? files.filter((f) => path.basename(f).includes(ignore.in)) : []
    );
    const strict = files.filter((f) => !exempt.has(f));

    const stdlibPass = (group: string[], withIgnore: boolean) => ({
        files: group,
        ecmaVersion: BROWSER_TARGET_ECMA,
        // Without `module` every ESM chunk fails on its own
        // `import`/`export`.
        module: true,
        // `checkFeatures` detects above-floor API names, but it also
        // raises the parser to the latest ES version, so it cannot
        // police syntax — hence the syntax pass below.
        checkFeatures: true,
        ...(withIgnore && ignore ? { ignore: ignore.features } : {}),
    });

    // Lazy: this module is reachable from every vite config, which every
    // vitest run loads. A static import pulls es-check (plus acorn and
    // fast-glob) into test startup for a gate that only runs at build
    // time — measured ~106 ms per config load.
    const { runChecks } = await import("es-check");
    const result = runChecks(
        [
            ...(strict.length ? [stdlibPass(strict, false)] : []),
            ...(exempt.size ? [stdlibPass([...exempt], true)] : []),
            {
                files,
                ecmaVersion: BROWSER_TARGET_ECMA,
                module: true,
                // Syntax pass: parses AT the floor, so anything the
                // bundler emitted verbatim above it (import
                // attributes, the RegExp `v` flag, `using`) fails here.
                checkFeatures: false,
            },
        ],
        // Without this es-check calls `process.exit` and kills the build.
        { isNodeAPI: true }
    );
    if (result.success) {
        console.log(
            `\n[es-version] ${files.length} chunks parse at ${BROWSER_TARGET_ECMA}`
        );
        return;
    }

    const detail = `Emitted JS is above the ${BROWSER_TARGET_ECMA} floor (${BROWSER_TARGET_SAFARI}) in ${root}:\n${result.errors
        .map((e) => {
            const features = e.err?.features?.join(", ");
            return `  ${e.file ?? "?"}: ${features ?? e.err?.message ?? "above-floor syntax"}`;
        })
        .join("\n")}`;
    if (!enforce) {
        console.warn(`[es-version] ${detail}`);
        return;
    }
    throw new Error(detail);
}
