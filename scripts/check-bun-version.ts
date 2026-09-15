#!/usr/bin/env bun
/**
 * Gates every file pinning the Bun version against `packageManager` in the root package.json.
 * Run: `bun run check:bun-version`.
 *
 * `packageManager` is what `oven-sh/setup-bun` resolves for CI; each Dockerfile's
 * `ARG BUN_VERSION` is what the deployed image runs, and nothing links the two. A partial
 * bump is silent — CI and the images just run different versions until something behaves oddly.
 */
import { readFileSync } from "node:fs";

/**
 * `pattern` must capture the version. Extraction failing is a failure, not a pass: a site
 * whose shape moved would otherwise compare empty to empty and gate nothing.
 */
type Site = {
    file: string;
    pattern: RegExp;
    /** Captured values expected. Fewer means the pattern rotted; more means a site was added. */
    values: number;
    why: string;
};

const TRUTH = {
    file: "package.json",
    pattern: /"packageManager":\s*"bun@([0-9]+\.[0-9]+\.[0-9]+)"/g,
    values: 1,
    why: "what setup-bun resolves for every CI job",
} satisfies Site;

const SITES: Site[] = [
    {
        file: "apps/business/Dockerfile",
        pattern: /^ARG BUN_VERSION=([0-9]+\.[0-9]+\.[0-9]+)$/gm,
        values: 1,
        why: "the business image build and runtime",
    },
    {
        file: "apps/listener/Dockerfile",
        pattern: /^ARG BUN_VERSION=([0-9]+\.[0-9]+\.[0-9]+)$/gm,
        values: 1,
        why: "the listener image build",
    },
    {
        file: "apps/shopify/Dockerfile",
        pattern: /^ARG BUN_VERSION=([0-9]+\.[0-9]+\.[0-9]+)$/gm,
        values: 1,
        why: "the shopify image build and runtime",
    },
    {
        file: "apps/wallet/Dockerfile",
        pattern: /^ARG BUN_VERSION=([0-9]+\.[0-9]+\.[0-9]+)$/gm,
        values: 1,
        why: "the wallet image build",
    },
    {
        file: "services/backend/Dockerfile",
        pattern: /^ARG BUN_VERSION=([0-9]+\.[0-9]+\.[0-9]+)$/gm,
        values: 1,
        why: "the backend bundles Elysia, which 1.4.1 could not build",
    },
    {
        file: "services/bootstrap/Dockerfile",
        pattern: /^ARG BUN_VERSION=([0-9]+\.[0-9]+\.[0-9]+)$/gm,
        values: 1,
        why: "migrations run before the backend deploys",
    },
    {
        file: "services/credential-sync/Dockerfile",
        pattern: /^ARG BUN_VERSION=([0-9]+\.[0-9]+\.[0-9]+)$/gm,
        values: 1,
        why: "the only alpine base — musl fixes land per release",
    },
];

function die(message: string): never {
    console.error(`❌ ${message}`);
    process.exit(1);
}

function read(file: string): string {
    try {
        return readFileSync(file, "utf8");
    } catch {
        return die(
            `${file} is unreadable — a Bun pin site was moved or deleted.`
        );
    }
}

function extract(site: Site): string[] {
    const found = [...read(site.file).matchAll(site.pattern)].flatMap((m) =>
        m.slice(1).filter((v): v is string => v !== undefined)
    );
    if (found.length !== site.values) {
        die(
            `${site.file}: expected ${site.values} Bun version reference(s) (${site.why}), found ${found.length}.\n` +
                "   Either the file changed shape or a site moved — update SITES in scripts/check-bun-version.ts."
        );
    }
    return found;
}

const [pinned] = extract(TRUTH);
if (!pinned) {
    die(`${TRUTH.file}: packageManager is not a pinned "bun@x.y.z".`);
}

const drifted: string[] = [];
for (const site of SITES) {
    for (const found of extract(site)) {
        if (found !== pinned) {
            drifted.push(`   ${site.file}: ${found} (${site.why})`);
        }
    }
}

if (drifted.length > 0) {
    die(
        `Bun version: ${TRUTH.file} pins ${pinned}, but:\n${drifted.join("\n")}\n` +
            "   CI and the images would run different Bun versions."
    );
}

console.log(
    `✅ Bun ${pinned} — ${SITES.length + 1} pin site(s) in step (packageManager + ${SITES.length} Dockerfile ARG)`
);
