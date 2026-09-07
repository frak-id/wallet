#!/usr/bin/env bun
/**
 * Holds every browser-shipped bundle to the ECMAScript floor by parsing what
 * the tsdown configs emitted.
 * Run: `bun run check:es-output`.
 */
import { glob } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
    assertEsVersion,
    BROWSER_TARGET_ECMA,
    NothingScannedError,
} from "../packages/dev-tooling/src/es-version";

// Anchored to the script, not the caller: every path below is repo-relative,
// and a run from anywhere else would report five configs as deleted.
// `import.meta.url` rather than Bun's `dir`, so the module also imports under
// a plain node runtime.
const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * One entry per tsdown config, naming where its builds land. Keyed by config
 * path so discovery can prove no config emits an unparsed directory.
 */
export type ConfigSite = {
    file: string;
    outDirs: string[];
    why: string;
};

/** Every tsdown config in the repo. Discovery cross-checks this list. */
const CONFIG_SITES: ConfigSite[] = [
    {
        file: "packages/rpc/tsdown.config.ts",
        outDirs: ["packages/rpc/dist"],
        why: "@frak-labs/frame-connector, imported by every SDK consumer",
    },
    {
        file: "sdk/core/tsdown.config.ts",
        outDirs: ["sdk/core/dist", "sdk/core/cdn"],
        why: "the NPM build and the CDN IIFE merchants load as FrakSDK",
    },
    {
        file: "sdk/legacy/tsdown.config.ts",
        outDirs: ["sdk/legacy/dist/bundle"],
        why: "the NexusSDK IIFE on jsdelivr — not a cdn/ path, so a glob misses it",
    },
    {
        file: "sdk/react/tsdown.config.ts",
        outDirs: ["sdk/react/dist"],
        why: "@frak-labs/react-sdk, bundled into merchant apps",
    },
    {
        file: "sdk/components/tsdown.config.ts",
        outDirs: ["sdk/components/dist", "sdk/components/cdn"],
        why: "the NPM build and the CDN bundle merchants load by script tag",
    },
];

const OUTPUT_DIRS = CONFIG_SITES.flatMap((site) =>
    site.outDirs.map((dir) => ({ dir, why: site.why }))
);

function die(message: string): never {
    console.error(`❌ ${message}`);
    process.exit(1);
}

/**
 * Every tsdown config on disk, so an unregistered one cannot ship ungated.
 * Matches any extension tsdown loads — a `.mts` or `.js` config would
 * otherwise be invisible to the one thing standing between a new build and
 * an unchecked one.
 */
async function discoverConfigs(): Promise<string[]> {
    const found: string[] = [];
    for await (const entry of glob("**/tsdown.config.*", {
        cwd: REPO_ROOT,
        exclude: ["**/node_modules/**"],
    })) {
        found.push(entry);
    }
    return found.sort();
}

/** Configs on disk that no registry entry claims. */
export function unregisteredConfigs(
    discovered: string[],
    sites: ConfigSite[] = CONFIG_SITES
): string[] {
    const registered: Record<string, true> = Object.fromEntries(
        sites.map((s) => [s.file, true])
    );
    return discovered.filter((f) => !registered[f]);
}

async function checkOutput(): Promise<void> {
    const unbuilt: string[] = [];
    const violations: string[] = [];

    const unregistered = unregisteredConfigs(await discoverConfigs());
    if (unregistered.length > 0) {
        die(
            `unregistered tsdown config(s):\n${unregistered.map((f) => `   ${f}`).join("\n")}\n` +
                "   Add each to CONFIG_SITES with the output directories it builds."
        );
    }

    for (const target of OUTPUT_DIRS) {
        try {
            await assertEsVersion({ root: path.join(REPO_ROOT, target.dir) });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            const bucket =
                error instanceof NothingScannedError ? unbuilt : violations;
            bucket.push(`${message}\n   (${target.why})`);
        }
    }

    if (unbuilt.length > 0) {
        die(
            `Nothing to check:\n${unbuilt.join("\n")}\n` +
                "   Run `bun run build:sdk` first — these outputs are gitignored."
        );
    }

    if (violations.length > 0) {
        die(
            `Emitted JS is above the floor:\n${violations.join("\n")}\n` +
                "   Fix the code, not the floor."
        );
    }

    console.log(
        `✅ ${OUTPUT_DIRS.length} output directories parse at ${BROWSER_TARGET_ECMA}`
    );
}

// Guarded so the module can be imported by its test without dispatching. The
// subcommand is still required: a bare invocation must not be mistaken for a
// check that ran.
if (import.meta.main) {
    const [command] = process.argv.slice(2);

    if (command !== "output") {
        die(
            `Expected the "output" subcommand${command ? ` (got "${command}")` : ""}.`
        );
    }
    await checkOutput();
}
