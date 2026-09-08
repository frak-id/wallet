#!/usr/bin/env bun
/**
 * Keeps safe-area insets in `.css.ts` on the `safeArea` token, not raw `env()`.
 *
 * Bare `env(safe-area-inset-*)` returns 0 on the Android Tauri WebView, which
 * draws edge-to-edge without populating the CSS values, so a site spelling it
 * by hand clips content behind the nav bar.
 */
import { readFileSync } from "node:fs";
import { glob } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Anchored to the script so every path is repo-relative regardless of caller.
const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** `example/` included: its apps ship the same components on the web. */
const ROOTS = ["apps", "packages", "sdk", "example"];

/**
 * `target` is Cargo's build output under `src-tauri`, and walking it costs ~30s
 * against ~1s for the rest of the tree combined.
 */
const PRUNED = [
    "**/node_modules/**",
    "**/target/**",
    "**/dist/**",
    "**/cdn/**",
];

/**
 * The two files that define the token itself: `tokens.css.ts` composes the
 * `var(--x, env(...))` expression every other site imports, and
 * `reset-globals.css.ts` assigns the custom properties it reads. WKWebView will
 * not evaluate `env()` from inside a `var()` fallback, which is why the seed
 * exists as a separate assignment at all.
 */
const ALLOWLIST: Record<string, true> = {
    "packages/design-system/src/tokens.css.ts": true,
    "packages/design-system/src/reset-globals.css.ts": true,
};
const BANNED = /env\(\s*safe-area-/;

function die(message: string): never {
    console.error(`❌ ${message}`);
    process.exit(1);
}

async function discover(): Promise<string[]> {
    const found: string[] = [];
    for (const root of ROOTS) {
        for await (const entry of glob(`${root}/**/*.css.ts`, {
            cwd: REPO_ROOT,
            exclude: PRUNED,
        })) {
            found.push(entry);
        }
    }
    return found.sort();
}

const files = await discover();

// Erring towards failure: a walk that finds nothing is a broken gate, not a
// clean tree, and would otherwise report success forever.
if (files.length === 0) {
    die(
        `no .css.ts files found under ${ROOTS.join(", ")} — the walk is broken, not the tree clean.`
    );
}

const offenders: string[] = [];
for (const file of files) {
    if (ALLOWLIST[file]) continue;
    const absolute = path.join(REPO_ROOT, file);
    let content: string;
    try {
        content = readFileSync(absolute, "utf8");
    } catch {
        die(`${file} is unreadable — it moved or was deleted mid-scan.`);
    }
    // Collapse newlines first: the expression can be wrapped across lines
    // inside a template literal, which a per-line test never sees.
    if (!BANNED.test(content.replace(/\s+/g, " "))) continue;
    const before = offenders.length;
    content.split("\n").forEach((line, i) => {
        if (BANNED.test(line)) offenders.push(`   ${file}:${i + 1}`);
    });
    // Split across lines, so no single line carries it — report the file.
    if (offenders.length === before) {
        offenders.push(`   ${file} (split across lines)`);
    }
}

if (offenders.length > 0) {
    die(
        `raw env(safe-area-*) outside the token definition:\n${offenders.join("\n")}\n` +
            "   Import `safeArea` from the design-system tokens instead — bare env() resolves to 0 on Android Tauri."
    );
}

console.log(
    `✅ safe-area insets — ${files.length} .css.ts file(s) scanned, all on the token`
);
