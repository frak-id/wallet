// Load-bearing, not redundant: consuming apps compile this file through their
// own tsconfig, whose `include` does not cover this package's `src`. Without
// the reference the lazy `es-check` import is an implicit `any` in every
// consumer.
/// <reference path="./es-check.d.ts" />
import { readFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { gzipSync } from "node:zlib";
import type { HtmlTagDescriptor, Plugin, Rollup } from "vite";
import type { AssertEsVersionOptions } from "./es-version";
import {
    assertEsVersion,
    BROWSER_TARGET_ECMA,
    BROWSER_TARGET_SAFARI,
} from "./es-version";

export function onwarn(
    warning: Rollup.RollupLog,
    warn: Rollup.LoggingFunction
) {
    /**
     * Hide warnings about invalid annotations
     * ../../node_modules/ox/_esm/core/Json.js (1:21): A comment
     * "/*#__PURE__/"
     * in "../../node_modules/ox/_esm/core/Json.js" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
     */
    if (
        warning.code === "INVALID_ANNOTATION" &&
        warning.url?.includes("#pure")
    ) {
        return;
    }

    /**
     * Hide warnings about Node.js modules being externalized for browser compatibility
     * These come from the ws package which has Node.js-specific code paths that won't be used in the browser
     */
    if (
        warning.plugin === "rolldown:vite-resolve" &&
        warning.message?.includes("externalized for browser compatibility") &&
        warning.message?.includes("ws/lib/")
    ) {
        return;
    }

    warn(warning);
}

// Re-exported so every existing import site keeps resolving from this module.
export { BROWSER_TARGET_ECMA, BROWSER_TARGET_SAFARI };

// Mutable by design: vite's `build.target` type rejects a readonly array.
export const BROWSER_TARGET: string[] = [
    BROWSER_TARGET_SAFARI,
    "chrome111",
    "edge111",
    "firefox114",
];

/**
 * {@link BROWSER_TARGET} in Lightning CSS's packed-integer encoding,
 * `(major << 16) | (minor << 8) | patch`. A bare `safari: 15.4` is silently
 * wrong here — the value must be packed.
 */
const LIGHTNINGCSS_TARGETS = {
    chrome: 111 << 16,
    edge: 111 << 16,
    firefox: 114 << 16,
    safari: (15 << 16) | (4 << 8),
};

/**
 * Shared Lightning CSS configuration for all Vite-based apps in the monorepo.
 * Provides consistent CSS processing with optimal performance and modern features.
 *
 * @example
 * ```ts
 * import { lightningCssConfig } from "@frak-labs/dev-tooling";
 *
 * export default defineConfig({
 *   css: lightningCssConfig,
 * });
 * ```
 */
export const lightningCssConfig = {
    transformer: "lightningcss" as const,
    lightningcss: {
        /**
         * CSS Modules configuration
         * - dashedIdents: false -> Use camelCase for class names (e.g., .my-class -> styles.myClass)
         */
        cssModules: {
            dashedIdents: false,
        },
        /**
         * Browser targets, packed from the shared floor.
         */
        targets: LIGHTNINGCSS_TARGETS,
        /**
         * Enable modern CSS draft features
         * - nesting: Native CSS nesting support (replaces postcss-preset-env)
         * - customMedia: Custom media queries (@custom-media)
         */
        drafts: {
            nesting: true,
            customMedia: true,
        },
    },
};

/**
 * Build-time plugin that strips `internalType: "..."` annotations from ABI
 * literals across the source tree.
 *
 * Why: `internalType` is foundry/abitype metadata (e.g. `"contract Foo"`,
 * `"struct Bar[]"`) preserved by abigen. Viem and wagmi ignore it at runtime;
 * removing it from the bundled code shaves ~25–30 bytes per ABI input/output.
 * Across `rewarderHubAbi`, `multiWebAuthNValidatorV2Abi`, `campaignBankAbi`,
 * and the kernel ABIs that adds up to several KB of dead bytes.
 *
 * Scope:
 *   - Source files only (`.ts` / `.tsx` outside `node_modules`)
 *   - Production build only (skipped in dev)
 *   - Strips both `, internalType: "x"` and `internalType: "x",` forms
 *
 * Safety: `internalType` is exclusively used inside ABI literals in this
 * codebase (verified by grepping `apps/`, `packages/`, `services/`). The regex
 * matches the property unconditionally, so any new non-ABI use of the same key
 * would also be stripped — keep this in mind if a third-party tool ever
 * standardises on the name.
 */
export function stripAbiInternalType(): Plugin {
    // Match the `internalType` property:
    //   - optional leading whitespace (handles indented multi-line ABI items)
    //   - the key + colon + quoted value (string contains no internal `"`)
    //   - an optional trailing comma
    const internalTypeRe = /\s*internalType\s*:\s*"[^"]*",?/g;

    return {
        name: "frak:strip-abi-internal-type",
        apply: "build",
        enforce: "pre",
        transform(code, id) {
            if (id.includes("/node_modules/")) return null;
            if (!/\.tsx?$/.test(id)) return null;
            if (!code.includes("internalType")) return null;

            return {
                code: code.replace(internalTypeRe, ""),
                // No accurate source map — production-only optimisation, the
                // small offset shifts are not worth the MagicString overhead.
                map: null,
            };
        },
    };
}

/**
 * Build-time plugin that inlines font-face CSS into `<style>` tags inside
 * `index.html` and emits `<link rel="preload">` hints for hand-picked font
 * files.
 *
 * Why: shipping `<link rel="stylesheet" href="/fonts/foo.css">` makes the CSS
 * a render-blocking dependency AND chains the woff2 fetch behind it (HTML →
 * css → woff2). Inlining the CSS removes the round-trip; preloading the
 * critical subset removes the chain. Net: ~150–450 ms saved on FCP/LCP
 * depending on network.
 *
 * Files are read at HTML transform time (works in dev and build). Paths are
 * resolved against the Vite project root so the plugin is portable across
 * apps in the monorepo.
 */
export type InlineFontFacesOptions = {
    /** Project-root-relative paths to CSS files to inline, in order. */
    cssFiles: string[];
    /**
     * Public URLs to add as `<link rel="preload" as="font" type="font/woff2"
     * crossorigin>`. Targets the LCP-critical subset — don't preload more than
     * 1–2 fonts or the budget gets eaten and other resources get delayed.
     */
    preload?: string[];
};

/**
 * Static module specifiers that ship on boot: `import ... from "./x.js"`, bare
 * `import "./x.js"`, and `export ... from "./x.js"` re-exports. The leading
 * non-identifier boundary (`[^\w$]`) anchors the keyword as a statement — it
 * covers `;`/`}`/newline separation (rolldown emits imports newline-separated,
 * no semicolons) without matching identifiers like `myimport`. The optional
 * `from` clause excludes dynamic `import("./x.js")`; `"\./"` excludes the
 * `"assets/*.js"` preload-helper dep arrays.
 */
const STATIC_IMPORT_RE =
    /(?:^|[^\w$])(?:import|export)\s*(?:[^"';]*from\s*)?"\.\/([^"]+\.js)"/g;

/**
 * Walk the transitive static-import closure from `entries` (chunk keys
 * relative to `dir`, e.g. `assets/index-abc123.js`) and return every
 * reachable chunk mapped to its file bytes.
 *
 * "Eager" = statically imported from the entry — a static `import` still
 * fetches the target on boot even if a `<link rel=modulepreload>` filter
 * strips it from the HTML preload list, so walking the closure from disk is
 * more reliable than trusting the preload list.
 *
 * Deps are resolved against the importing chunk's own directory, so the walk
 * works for any `chunkFileNames` layout — `assets/`, `standalone/`, or a mix.
 */
export function collectEagerClosure(
    dir: string,
    entries: string[]
): Map<string, Buffer> {
    // Maps each reachable chunk key to its bytes so the budget gate gzips what
    // was already read here (one disk read per chunk, no re-encode).
    const eager = new Map<string, Buffer>();
    const stack = [...entries];
    while (stack.length > 0) {
        const key = stack.pop();
        if (!key || eager.has(key)) continue;
        let code: Buffer;
        try {
            code = readFileSync(path.join(dir, key));
        } catch {
            continue;
        }
        eager.set(key, code);
        const chunkDir = path.posix.dirname(key);
        for (const m of code.toString("utf-8").matchAll(STATIC_IMPORT_RE)) {
            const dep = path.posix.join(chunkDir, m[1]);
            if (!eager.has(dep)) stack.push(dep);
        }
    }
    return eager;
}

export type AssertEagerBundleBudgetOptions = {
    /** Hard ceiling on the gzipped eager boot JS, in bytes. */
    budgetGzip: number;
    /**
     * Whether going over `budgetGzip` fails the build. Defaults to `true`.
     *
     * Set to `false` for apps where an eager-size regression is a perf smell
     * rather than an incident: the size and over-budget breakdown are still
     * logged, but the build proceeds. Keeps the signal without turning every
     * login-path feature into a blocked deploy that gets unblocked by raising
     * the number (which makes the budget a moving line, not a ratchet).
     */
    enforce?: boolean;
    /**
     * Optional hook run with each measured HTML source before the budget
     * check, e.g. to assert no lazy-chunk CSS/JS leaked into the eager HTML.
     * Throw from this hook to fail the build with a custom message.
     */
    assertHtml?: (htmlSource: string, htmlFile: string) => void;
    /**
     * Entry HTML files to measure, relative to the output dir. Defaults to
     * `["index.html"]`. Each file is walked and budgeted INDEPENDENTLY: in a
     * multi-entry build the budget describes what one visitor downloads, not
     * the sum across pages they will never all open.
     */
    htmlFiles?: string[];
};

/**
 * Build-time plugin factory: report the eager boot JS (the transitive
 * static-import closure from the entry, walked by
 * {@link collectEagerClosure}) against `budgetGzip`, failing the build when
 * it goes over unless `enforce: false`.
 *
 * Shared between apps that watch their eager boot bundle — each app passes
 * its own measured-plus-headroom budget. Extracted from the listener's
 * original inline `assert-eager-bundle-budget` plugin so the closure-walk
 * logic has one implementation.
 */
export function assertEagerBundleBudget(
    options: AssertEagerBundleBudgetOptions
): Plugin {
    const {
        budgetGzip,
        assertHtml,
        enforce = true,
        htmlFiles = ["index.html"],
    } = options;
    // Any output directory, not just `assets/`: a multi-entry build may route
    // its chunks elsewhere (see the wallet's `standalone/` pass).
    const scriptRe = /<script\b[^>]*\bsrc="\/?([^"]+\.js)"/g;

    return {
        name: "frak:assert-eager-bundle-budget",
        apply: "build" as const,
        // writeBundle (post-write) so the final, fully-transformed HTML and
        // every chunk are on disk — avoids in-memory bundle timing/encoding edge
        // cases where the emitted HTML asset isn't yet a string in generateBundle.
        writeBundle(buildOptions: { dir?: string }) {
            const dir = buildOptions.dir;
            if (!dir) return;

            for (const htmlFile of htmlFiles) {
                measureEntry({
                    dir,
                    htmlFile,
                    scriptRe,
                    budgetGzip,
                    enforce,
                    assertHtml,
                });
            }
        },
    };
}

export type AssertBundleEsVersionOptions = {
    /**
     * Directory under the build output whose `.js` files are checked,
     * e.g. `"standalone"`. Omit to check every `.js` under the output dir.
     */
    subdir?: string;
    /**
     * Whether a violation fails the build. Defaults to `true`. `false` logs
     * the offending files and continues, matching
     * {@link AssertEagerBundleBudgetOptions.enforce}.
     */
    enforce?: boolean;
    /** @see AssertEsVersionOptions.ignore */
    ignore?: AssertEsVersionOptions["ignore"];
    /**
     * Restricts the gate to the named build environments, for a config whose
     * one plugin instance sees more than one — React Router's
     * `v8_viteEnvironmentApi` builds client and server in turn. A name that
     * matches no configured environment throws rather than passing: vite
     * drops an unapplied plugin silently, which would remove the gate.
     */
    environments?: string[];
};

/**
 * Build-time plugin factory: reject emitted chunks that use syntax or stdlib
 * APIs above {@link BROWSER_TARGET_ECMA}.
 *
 * A thin adapter over {@link assertEsVersion}: it resolves `dir` + `subdir`
 * into the core's `root` and applies the environment guard. Every decision
 * about what counts as above-floor lives in the core, so this gate and the
 * standalone post-build check cannot disagree.
 */
export function assertBundleEsVersion(
    options: AssertBundleEsVersionOptions = {}
): Plugin {
    const { subdir, enforce = true, ignore, environments } = options;

    return {
        name: "frak:assert-bundle-es-version",
        apply: "build" as const,
        ...(environments && {
            // Vite's resolveEnvironmentPlugins drops a plugin whose predicate
            // returns false, with no warning — so a typo would delete the gate
            // from every environment and still report a green build.
            configResolved(config: { environments?: Record<string, unknown> }) {
                const known = Object.keys(config.environments ?? {});
                // `[]` is truthy, so without this an empty list would install
                // a predicate false for every name — the silent drop again.
                const missing = environments.length
                    ? environments.filter((n) => !known.includes(n))
                    : ["(empty list)"];
                if (missing.length > 0) {
                    throw new Error(
                        `[es-version] no such build environment: ${missing.join(", ")}. Configured: ${known.join(", ") || "(none)"}.`
                    );
                }
            },
            applyToEnvironment: (environment: { name: string }) =>
                environments.includes(environment.name),
        }),
        // writeBundle for the same reason as the budget gate: every chunk is
        // final and on disk.
        async writeBundle(buildOptions: { dir?: string }) {
            const dir = buildOptions.dir;
            if (!dir) return;

            const root = subdir ? path.join(dir, subdir) : dir;
            await assertEsVersion({ root, enforce, ignore });
        },
    };
}

/** One HTML entry, walked and budgeted on its own. */
function measureEntry({
    dir,
    htmlFile,
    scriptRe,
    budgetGzip,
    enforce,
    assertHtml,
}: {
    dir: string;
    htmlFile: string;
    scriptRe: RegExp;
    budgetGzip: number;
    enforce: boolean;
    assertHtml?: (htmlSource: string, htmlFile: string) => void;
}) {
    let htmlSource: string;
    try {
        htmlSource = readFileSync(path.join(dir, htmlFile), "utf-8");
    } catch {
        return;
    }

    assertHtml?.(htmlSource, htmlFile);

    const entries: string[] = [];
    // `matchAll` on a shared /g regex is safe: it clones the regex internally.
    for (const m of htmlSource.matchAll(scriptRe)) entries.push(m[1]);

    const eager = collectEagerClosure(dir, entries);

    let totalGzip = 0;
    const breakdown: string[] = [];
    for (const [key, code] of eager) {
        const gz = gzipSync(code).length;
        totalGzip += gz;
        breakdown.push(`  ${key}: ${(gz / 1024).toFixed(2)} KB gz`);
    }

    const totalKb = (totalGzip / 1024).toFixed(2);
    const overBudget = totalGzip > budgetGzip;
    console.log(
        `\n[eager-budget] ${htmlFile} boot JS: ${totalKb} KB gz across ${eager.size} chunks (limit ${budgetGzip / 1024} KB)${
            overBudget && !enforce ? " — OVER BUDGET (warn-only)" : ""
        }`
    );
    if (!overBudget) return;

    const detail = `Eager boot JS budget exceeded for ${htmlFile}: ${totalKb} KB gz > ${budgetGzip / 1024} KB.\n${breakdown
        .sort()
        .join("\n")}`;
    if (!enforce) {
        console.warn(`[eager-budget] ${detail}`);
        return;
    }
    throw new Error(detail);
}

export type PreconnectOrigin = {
    /** Absolute URL; only its origin is used. */
    url: string | undefined;
    /**
     * CORS mode of the requests that will follow, which the hint has to match:
     * a connection opened under the wrong mode cannot be reused, leaving only
     * the DNS lookup shared, since resolution is unaffected by CORS.
     *
     * Omitting this is not the same as `"anonymous"` — a bare hint matches
     * `no-cors`, while `crossorigin=""` matches anonymous CORS. So omit it for
     * `no-cors` (a document navigation, or an image without `crossorigin`),
     * `"anonymous"` for CORS without credentials, `"use-credentials"` for CORS
     * that sends them. An origin fetched under more than one mode needs one
     * entry per mode.
     */
    crossorigin?: "anonymous" | "use-credentials";
};

export type PreconnectOriginsOptions = {
    /**
     * Origins to open a connection to. Anything unparseable, or pointing
     * somewhere other than http(s), is dropped rather than emitted as a broken
     * hint.
     */
    origins: PreconnectOrigin[];
};

/**
 * Emit `<link rel="preconnect">` into the HTML for origins the app is certain
 * to call.
 *
 * This has to be a build-time tag rather than a runtime one. The entry module
 * cannot hint at its own behalf: by the time its first line executes the
 * browser has already downloaded and parsed it and every vendor chunk the HTML
 * lists as `modulepreload`, which is the exact window a preconnect exists to
 * use. Only a tag the preload scanner finds while parsing `<head>` lands early
 * enough to matter.
 *
 * Each entry states the CORS mode of the requests that will follow, because a
 * connection opened under a different mode cannot be reused for them.
 */
export function preconnectOrigins(options: PreconnectOriginsOptions): Plugin {
    const seen = new Set<string>();
    const hints: { origin: string; crossorigin?: string }[] = [];

    for (const { url, crossorigin } of options.origins) {
        if (!url) continue;
        let origin: string;
        try {
            const parsed = new URL(url);
            if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
                continue;
            }
            origin = parsed.origin;
        } catch {
            continue;
        }

        // Keyed by mode too: the same origin legitimately needs one connection
        // per mode when it is fetched both ways.
        const key = `${origin}|${crossorigin ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        hints.push({ origin, crossorigin });
    }

    return {
        name: "frak:preconnect-origins",
        transformIndexHtml() {
            return hints.map(({ origin, crossorigin }) => ({
                tag: "link",
                attrs: {
                    rel: "preconnect",
                    href: origin,
                    ...(crossorigin ? { crossorigin } : {}),
                },
                // Prepend: `head` appends after the injected module scripts
                // and their `modulepreload` links, which puts the hint behind
                // the very downloads it is meant to run alongside.
                injectTo: "head-prepend" as const,
            }));
        },
    };
}

export function inlineFontFaces(options: InlineFontFacesOptions): Plugin {
    let projectRoot = process.cwd();
    return {
        name: "frak:inline-font-faces",
        configResolved(config) {
            projectRoot = config.root;
        },
        async transformIndexHtml() {
            const cssParts = await Promise.all(
                options.cssFiles.map((file) =>
                    fs.readFile(path.resolve(projectRoot, file), "utf-8")
                )
            );
            const css = cssParts.join("\n");

            const tags: HtmlTagDescriptor[] = [];
            for (const href of options.preload ?? []) {
                tags.push({
                    tag: "link",
                    attrs: {
                        rel: "preload",
                        as: "font",
                        type: "font/woff2",
                        crossorigin: "",
                        href,
                    },
                    injectTo: "head",
                });
            }
            tags.push({
                tag: "style",
                children: css,
                injectTo: "head",
            });
            return tags;
        },
    };
}
