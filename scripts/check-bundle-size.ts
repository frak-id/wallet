#!/usr/bin/env bun
/**
 * Holds the SDK CDN files and the listener's sharing page and modal to a gzip budget.
 * Run: `bun run check:bundle-size`, after `bun run build:sdk` and the listener build.
 */
import { readdirSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { collectEagerClosure } from "../packages/dev-tooling/src/vite";

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHUNK_HASH_LENGTH = 8;

export type BudgetEntry =
    | { kind: "file"; name: string }
    | { kind: "chunk"; name: string };

export type Budget = {
    label: string;
    dir: string;
    entry: BudgetEntry;
    maxGzipBytes: number;
    why: string;
    buildCommand: string;
};

export type BudgetResult =
    | { kind: "missing"; budget: Budget; reason: string }
    | {
          kind: "measured";
          budget: Budget;
          gzipBytes: number;
          chunks: { key: string; gzipBytes: number }[];
      };

const BUILD_SDK = "bun run build:sdk";
const BUILD_LISTENER = "bun run --cwd apps/listener build";

export const BUDGETS: Budget[] = [
    {
        label: "SDK core CDN bundle",
        dir: "sdk/core/cdn",
        entry: { kind: "file", name: "bundle.js" },
        maxGzipBytes: 35 * 1024,
        why: "FrakSDK IIFE that every merchant page loads by script tag",
        buildCommand: BUILD_SDK,
    },
    {
        label: "SDK components CDN loader",
        dir: "sdk/components/cdn",
        entry: { kind: "file", name: "loader.js" },
        maxGzipBytes: 38 * 1024,
        why: "loader.js that every merchant page loads by script tag",
        buildCommand: BUILD_SDK,
    },
    {
        label: "Listener sharing page",
        dir: "apps/listener/dist/assets",
        entry: { kind: "chunk", name: "lazy-shared" },
        maxGzipBytes: 115 * 1024,
        why: "the sharing page lives in the lazy-shared chunk; a listener chunking change that moves it must update this entry",
        buildCommand: BUILD_LISTENER,
    },
    {
        label: "Listener modal",
        dir: "apps/listener/dist/assets",
        entry: { kind: "chunk", name: "Modal" },
        maxGzipBytes: 234 * 1024,
        why: "the modal chunk the listener loads when a merchant opens a flow",
        buildCommand: BUILD_LISTENER,
    },
];

const kb = (bytes: number) => `${(bytes / 1024).toFixed(2)} KB`;

function resolveEntry(
    root: string,
    entry: BudgetEntry
): { key: string } | { reason: string } {
    let files: string[];
    try {
        files = readdirSync(root);
    } catch {
        return { reason: "output directory does not exist" };
    }
    // Vite names chunks `<name>-<hash>.js`, tsdown `<name>.<hash>.js`.
    const prefixes = [`${entry.name}-`, `${entry.name}.`];
    const matches =
        entry.kind === "file"
            ? files.filter((f) => f === entry.name)
            : files.filter((f) =>
                  prefixes.some(
                      (prefix) =>
                          f.startsWith(prefix) &&
                          f.endsWith(".js") &&
                          f.length ===
                              prefix.length + CHUNK_HASH_LENGTH + ".js".length
                  )
              );
    if (matches.length === 0) {
        return { reason: `no ${entry.kind} "${entry.name}" in the output` };
    }
    if (matches.length > 1) {
        return {
            reason: `${entry.kind} "${entry.name}" is ambiguous: ${matches.join(", ")}`,
        };
    }
    return { key: matches[0] };
}

export function measureBudget(budget: Budget, repoRoot: string): BudgetResult {
    const root = path.join(repoRoot, budget.dir);
    const resolved = resolveEntry(root, budget.entry);
    if ("reason" in resolved) {
        return { kind: "missing", budget, reason: resolved.reason };
    }
    const closure = collectEagerClosure(root, [resolved.key]);
    const chunks = [...closure].map(([key, code]) => ({
        key,
        gzipBytes: gzipSync(code).length,
    }));
    const gzipBytes = chunks.reduce((sum, c) => sum + c.gzipBytes, 0);
    return { kind: "measured", budget, gzipBytes, chunks };
}

export function isOverBudget(result: BudgetResult): boolean {
    return (
        result.kind === "measured" &&
        result.gzipBytes > result.budget.maxGzipBytes
    );
}

function report(results: BudgetResult[]): boolean {
    let failed = false;
    for (const result of results) {
        const { budget } = result;
        if (result.kind === "missing") {
            failed = true;
            console.error(
                `❌ ${budget.label}: ${result.reason} in ${budget.dir}. Run \`${budget.buildCommand}\` first.`
            );
            continue;
        }
        const headroom = budget.maxGzipBytes - result.gzipBytes;
        const over = isOverBudget(result);
        const line = `${over ? "❌" : "✅"} ${budget.label}: ${kb(result.gzipBytes)} gz of ${kb(budget.maxGzipBytes)} (${over ? "over by" : "headroom"} ${kb(Math.abs(headroom))})`;
        if (!over) {
            console.log(line);
            continue;
        }
        failed = true;
        console.error(line);
        console.error(`   ${budget.why}`);
        for (const c of [...result.chunks].sort(
            (a, b) => b.gzipBytes - a.gzipBytes
        )) {
            console.error(`   ${kb(c.gzipBytes).padStart(10)}  ${c.key}`);
        }
    }
    return !failed;
}

if (import.meta.main) {
    const results = BUDGETS.map((b) => measureBudget(b, REPO_ROOT));
    if (!report(results)) process.exit(1);
}
