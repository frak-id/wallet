#!/usr/bin/env bun
/**
 * Holds every browser-shipped bundle to the ECMAScript floor. `targets` gates the
 * tsdown configs against BROWSER_TARGET_ECMA; `output` parses what they emitted.
 * Run: `bun run check:es-targets` / `bun run check:es-output`.
 */
import { readFileSync } from "node:fs";
import { glob } from "node:fs/promises";
import * as path from "node:path";
import {
    assertEsVersion,
    BROWSER_TARGET_ECMA,
    NothingScannedError,
} from "../packages/dev-tooling/src/es-version";

// Anchored to the script, not the caller: every path below is repo-relative,
// and a run from anywhere else would report five configs as deleted.
const REPO_ROOT = path.join(import.meta.dir, "..");

/**
 * One entry per tsdown config, holding both its `target` count and where its
 * builds land — kept together so a config cannot be registered for the text
 * scan while its output goes unparsed. Both are cross-checked against the
 * config source, since a registry that only agrees with itself gates nothing.
 */
type ConfigSite = {
    file: string;
    targets: number;
    outDirs: string[];
    why: string;
};

/** Every tsdown config in the repo. Discovery cross-checks this list. */
const CONFIG_SITES: ConfigSite[] = [
    {
        file: "packages/rpc/tsdown.config.ts",
        targets: 1,
        outDirs: ["packages/rpc/dist"],
        why: "@frak-labs/frame-connector, imported by every SDK consumer",
    },
    {
        file: "sdk/core/tsdown.config.ts",
        targets: 2,
        outDirs: ["sdk/core/dist", "sdk/core/cdn"],
        why: "the NPM build and the CDN IIFE merchants load as FrakSDK",
    },
    {
        file: "sdk/legacy/tsdown.config.ts",
        targets: 1,
        outDirs: ["sdk/legacy/dist/bundle"],
        why: "the NexusSDK IIFE on jsdelivr — not a cdn/ path, so a glob misses it",
    },
    {
        file: "sdk/react/tsdown.config.ts",
        targets: 1,
        outDirs: ["sdk/react/dist"],
        why: "@frak-labs/react-sdk, bundled into merchant apps",
    },
    {
        file: "sdk/components/tsdown.config.ts",
        targets: 2,
        outDirs: ["sdk/components/dist", "sdk/components/cdn"],
        why: "the NPM build and the CDN bundle merchants load by script tag",
    },
];

const OUTPUT_DIRS = CONFIG_SITES.flatMap((site) =>
    site.outDirs.map((dir) => ({ dir, why: site.why }))
);

// Text scans, so a `target` inside a comment satisfies one. Accepted: the
// count pin catches a config whose shape moved, and the output check is what
// actually proves the floor.
const TARGET_PATTERN = /target:\s*"([^"]+)"/g;
const OUT_DIR_PATTERN = /outDir:\s*"([^"]+)"/g;

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

async function checkTargets(): Promise<void> {
    const failures: string[] = [];

    for (const site of CONFIG_SITES) {
        let source: string;
        try {
            source = readFileSync(path.join(REPO_ROOT, site.file), "utf8");
        } catch {
            failures.push(
                `${site.file} is unreadable — a config was moved or deleted.`
            );
            continue;
        }
        const found = [...source.matchAll(TARGET_PATTERN)].map((m) => m[1]);
        if (found.length !== site.targets) {
            failures.push(
                `${site.file}: expected ${site.targets} target(s) (${site.why}), found ${found.length}.\n` +
                    "   The config changed shape — update CONFIG_SITES in scripts/check-es-version.ts."
            );
            continue;
        }
        const wrong = found.filter((v) => v !== BROWSER_TARGET_ECMA);
        if (wrong.length > 0) {
            failures.push(
                `${site.file}: target ${wrong.map((v) => `"${v}"`).join(", ")} — the floor is "${BROWSER_TARGET_ECMA}" (${site.why}).`
            );
        }

        // Registering a config is not enough: its outputs have to match what
        // the config actually emits, or a build ships unparsed while both the
        // target count and the registry agree with themselves.
        const pkg = path.dirname(site.file);
        const declared = [...source.matchAll(OUT_DIR_PATTERN)]
            .map((m) => path.join(pkg, m[1].replace(/^\.\//, "")))
            .sort();
        const registeredDirs = [...site.outDirs].sort();
        if (declared.join("|") !== registeredDirs.join("|")) {
            failures.push(
                `${site.file}: emits [${declared.join(", ") || "none"}] but CONFIG_SITES registers [${registeredDirs.join(", ")}].\n` +
                    "   Every emitted directory must be listed, or its output ships unparsed."
            );
        }
    }

    const registered: Record<string, true> = Object.fromEntries(
        CONFIG_SITES.map((s) => [s.file, true])
    );
    const unregistered = (await discoverConfigs()).filter(
        (f) => !registered[f]
    );
    if (unregistered.length > 0) {
        failures.push(
            `unregistered tsdown config(s):\n${unregistered.map((f) => `   ${f}`).join("\n")}\n` +
                "   Add each to CONFIG_SITES with the output directories it builds."
        );
    }

    if (failures.length > 0) {
        die(`ES target drift:\n${failures.join("\n")}`);
    }

    const sites = CONFIG_SITES.reduce((n, s) => n + s.targets, 0);
    console.log(
        `✅ ${sites} tsdown targets across ${CONFIG_SITES.length} configs match ${BROWSER_TARGET_ECMA}`
    );
}

async function checkOutput(): Promise<void> {
    const unbuilt: string[] = [];
    const violations: string[] = [];

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

// No default: the two subcommands check different things, and defaulting a
// bare invocation to the cheap one would report green having parsed nothing.
const [command] = process.argv.slice(2);

switch (command) {
    case "targets":
        await checkTargets();
        break;
    case "output":
        await checkOutput();
        break;
    default:
        die(
            `Expected a subcommand: targets or output${command ? ` (got "${command}")` : ""}.`
        );
}
