/**
 * Per-surface bundle cost for the listener.
 *
 * `vite build` prints one line per chunk, which is misleading here: the
 * listener's chunks statically import each other, so the cost of displaying a
 * surface is the transitive closure from the chunk that hosts it, not the
 * chunk's own size. Moving a module between two chunks that are BOTH in the
 * same closure looks like a win per-chunk and is actually a no-op — or worse,
 * a regression for the other surface.
 *
 * Usage:
 *   bun run --cwd apps/listener build
 *   node apps/listener/scripts/chunk-closure.mjs [label]
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../dist/assets");

let files;
try {
    files = readdirSync(dir).filter((f) => f.endsWith(".js"));
} catch {
    console.error(`No build output at ${dir} — run \`bun run build\` first.`);
    process.exit(1);
}

const gzCache = new Map();
const sizeOf = (f) => {
    if (!gzCache.has(f))
        gzCache.set(f, gzipSync(readFileSync(join(dir, f))).length);
    return gzCache.get(f);
};

/** Static (not dynamic) import edges between emitted chunks. */
const edges = new Map();
for (const f of files) {
    const src = readFileSync(join(dir, f), "utf8");
    const deps = new Set();
    for (const m of src.matchAll(/from\s*"\.\/([A-Za-z0-9_.-]+\.js)"/g))
        deps.add(m[1]);
    for (const m of src.matchAll(/import\s*"\.\/([A-Za-z0-9_.-]+\.js)"/g))
        deps.add(m[1]);
    edges.set(f, deps);
}

const closure = (start) => {
    const seen = new Set();
    const stack = [start];
    while (stack.length) {
        const cur = stack.pop();
        if (!cur || seen.has(cur)) continue;
        seen.add(cur);
        for (const d of edges.get(cur) ?? []) stack.push(d);
    }
    return seen;
};

const chunkNamed = (prefix) => files.find((f) => f.startsWith(`${prefix}-`));

// SharingPage has no chunk of its own — `lazy-shared`'s regex claims it.
const surfaces = {
    "SharingPage (hosted in lazy-shared)": chunkNamed("lazy-shared"),
    Modal: chunkNamed("Modal"),
};

const kb = (n) => `${(n / 1024).toFixed(2)} KB gz`;

console.log(`\n=== ${process.argv[2] ?? "listener chunk closure"} ===`);
for (const [name, chunk] of Object.entries(surfaces)) {
    if (!chunk) {
        console.log(`${name}: <no chunk emitted>`);
        continue;
    }
    const members = [...closure(chunk)].sort();
    const total = members.reduce((n, f) => n + sizeOf(f), 0);
    console.log(`\n${name} — ${kb(total)}`);
    for (const f of members) {
        console.log(
            `    ${(sizeOf(f) / 1024).toFixed(1).padStart(6)} KB  ${f}`
        );
    }
}
console.log(
    `\nALL emitted JS: ${kb(files.reduce((n, f) => n + sizeOf(f), 0))}\n`
);
