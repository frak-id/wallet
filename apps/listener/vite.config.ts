import { readFileSync } from "node:fs";
import * as path from "node:path";
import * as process from "node:process";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import preact from "@preact/preset-vite";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import type { UserConfig } from "vite";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import removeConsole from "vite-plugin-remove-console";
import {
    getSandboxEnv,
    getSstResource,
    inlineFontFaces,
    lightningCssConfig,
    onwarn,
} from "../../packages/dev-tooling";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Build-time stub that swaps every `@tauri-apps/*` and `tauri-plugin-*`
// runtime path with a no-op module. The listener iframe never executes Tauri
// code (every call site is dead under `IS_TAURI = false`), so the stub keeps
// the actual `invoke` / `transformCallback` runtime out of the bundle.
// Single shared stub lives in `wallet-shared` and is also used by the wallet
// web build.
const tauriStub = path.resolve(
    __dirname,
    "../../packages/wallet-shared/src/stubs/tauri-noop.ts"
);

// Absolute paths for preact aliases. The listener installs preact directly
// (`apps/listener/node_modules/preact`), but `wallet-shared` (and other workspace
// packages consumed via the `development` export condition) import from "react"
// and have no preact in their own `node_modules`. Resolving aliases to absolute
// paths sidesteps Bun's per-package node_modules layout so every importer ends
// up bundling the same preact/compat module.
const preactCompat = path.resolve(__dirname, "node_modules/preact/compat");
const preactCompatClient = path.resolve(
    __dirname,
    "node_modules/preact/compat/client"
);
const preactJsxRuntime = path.resolve(
    __dirname,
    "node_modules/preact/jsx-runtime"
);

// Dedupe zustand: @wagmi/core pins zustand@5.0.0 while the workspace catalog
// resolves 5.0.13, so without an alias Rolldown bundles BOTH copies (the
// persist middleware shipped twice — once in `common`, once in `vendor`).
// Absolute-path aliases force every importer (app code and @wagmi/core) onto
// the single listener-installed copy, mirroring the preact aliases above.
const zustandRoot = path.resolve(__dirname, "node_modules/zustand/esm");

const DEBUG = JSON.stringify(false);

// Single source of truth for the lazy (Ring 1/2) chunk name roots, consumed by
// the modulePreload filter, the orphan-import stripper and the eager-CSS
// stripper. Add a new lazy chunk group here, not in each regex.
const LAZY_CHUNK_NAMES = [
    "blockchain-vendor",
    "BaseProvider",
    "Modal",
    "Wallet",
    "SharingPage",
    "ccip",
    "secp256k1",
    "lazy-shared",
    "ui-vendor",
    "ui-runtime",
] as const;
const LAZY_CHUNK_ALTERNATION = LAZY_CHUNK_NAMES.join("|");

// Hard ceiling on the gzipped eager boot JS (transitive static-import closure
// from the entry, walked by `assertEagerBundleBudget`). Measured ~28 KB; 32 KB
// leaves headroom while failing the build if a lazy chunk leaks into the eager
// path.
const EAGER_JS_BUDGET_GZIP = 32 * 1024;

const isProd = process.env.STAGE?.includes("prod") ?? false;
const isSandbox = !!process.env.ATELIER_SANDBOX_ID;

// Mobile deep-link scheme — must match the wallet variant the listener pairs with:
// prod listener (wallet.frak.id) opens the prod wallet (id.frak.wallet) via frakwallet://,
// dev listener (wallet-dev.frak.id) opens the dev wallet (id.frak.wallet.dev) via frakwallet-dev://.
const deepLinkScheme = isProd ? "frakwallet://" : "frakwallet-dev://";

/**
 * Rolldown emits a side-effect-only `import "./<chunk>.js";` at the top of
 * downstream chunks even when the imported chunk is empty or has no bound
 * symbols. This appears to be a chunking artifact: side-effect-free
 * re-export barrels (e.g. from workspace `dist/index.js`) collapse to a
 * zero-byte chunk, but Rolldown preserves the static-evaluation-order
 * import "just in case".
 *
 * Effect on the iframe: the browser fetches the chunk on cold boot even
 * though it is empty (or near-empty) and the modulePreload filter strips
 * it from the HTML. That extra round trip defeats the lazy strategy.
 *
 * This plugin:
 *  1. Scans the emitted bundle for chunks with empty/whitespace-only code.
 *  2. Strips every `import "./<name>.js";` referencing those orphan chunks.
 *  3. Deletes the orphan chunks from the bundle so they aren't written.
 *
 * It ALSO strips orphan side-effect imports of known lazy-only chunks
 * (blockchain-vendor, BaseProvider, ui-vendor, ui-runtime, lazy-shared,
 * Modal, Wallet, SharingPage). Those chunks are not empty, but Rolldown
 * sometimes hoists their side-effect imports into eager chunks even when
 * no bound symbols cross the boundary — forcing the iframe to download
 * lazy chunks on boot. Real dynamic-import call sites (`__vitePreload(...)`)
 * are preserved because they don't use the top-level `import "...";` form.
 */
function stripOrphanCrossChunkImports() {
    const LAZY_ORPHAN_RE = new RegExp(
        `import\\s*"\\./(?:${LAZY_CHUNK_ALTERNATION})-[A-Za-z0-9_-]+\\.js";`,
        "g"
    );
    return {
        name: "strip-orphan-cross-chunk-imports",
        apply: "build" as const,
        generateBundle(_options: unknown, bundle: Record<string, unknown>) {
            type Chunk = { type?: string; fileName?: string; code?: string };
            const chunks = Object.entries(bundle) as [string, Chunk][];

            // Pass 1: drop chunks whose code is empty (zero-byte phantoms
            // produced by Rolldown when a side-effect-free re-export barrel
            // collapses to nothing). Their import statements would otherwise
            // remain in every consumer chunk on cold boot.
            const orphanFileNames: string[] = [];
            for (const [key, file] of chunks) {
                if (
                    file.type === "chunk" &&
                    file.fileName &&
                    typeof file.code === "string" &&
                    file.code.trim() === ""
                ) {
                    orphanFileNames.push(file.fileName);
                    delete bundle[key];
                }
            }
            const orphanPatterns = orphanFileNames.map((name) => {
                const escaped = name
                    .replace(/^assets\//, "")
                    .replace(/[.+?^${}()|[\]\\]/g, "\\$&");
                return new RegExp(`import\\s*"\\./${escaped}";`, "g");
            });
            // Pass 2: strip orphan side-effect imports from surviving chunks.
            for (const file of Object.values(bundle)) {
                const f = file as {
                    type?: string;
                    code?: string;
                };
                if (f.type === "chunk" && typeof f.code === "string") {
                    f.code = f.code.replace(LAZY_ORPHAN_RE, "");
                    for (const re of orphanPatterns) {
                        f.code = f.code.replace(re, "");
                    }
                }
            }
        },
    };
}

/**
 * Drop render-blocking `<link rel="stylesheet">` tags for lazy chunks (e.g.
 * `ui-runtime.css`) from `index.html`. Vite emits them even though the chunk's
 * JS is dynamic-imported and the CSS is already in the chunk's `__vitePreload`
 * dep map (so the dynamic import re-injects it on Ring 1 mount). On the bare
 * RPC boot path — no UI shown — the eager link is pure waste blocking first paint.
 */
function stripEagerLazyCss() {
    // Key on the href chunk-name alone, not rel="stylesheet" before href: a Vite
    // upgrade that reorders <link> attributes would otherwise silently no-op this
    // stripper. assertEagerBundleBudget fails the build if a lazy CSS link slips
    // through, so any future break is loud rather than silent.
    const lazyCssLinkRe = new RegExp(
        `\\s*<link\\b[^>]*\\bhref="[^"]*(?:${LAZY_CHUNK_ALTERNATION})-[A-Za-z0-9_-]+\\.css"[^>]*>`,
        "g"
    );
    return {
        name: "strip-eager-lazy-css",
        apply: "build" as const,
        transformIndexHtml: {
            order: "post" as const,
            handler(html: string) {
                return html.replace(lazyCssLinkRe, "");
            },
        },
    };
}

/**
 * Fail loudly if {@link stripEagerLazyCss} no-op'd (e.g. a Vite upgrade changed
 * the `<link>` attribute order/format): a surviving lazy-chunk CSS link would
 * ship a render-blocking stylesheet on every iframe boot. Keyed on the href
 * chunk-name so it is attribute-order independent, mirroring the stripper.
 */
function assertNoLazyCssLeak(htmlSource: string) {
    const leakedLazyCssRe = new RegExp(
        `<link\\b[^>]*\\bhref="[^"]*(?:${LAZY_CHUNK_ALTERNATION})-[A-Za-z0-9_-]+\\.css"`
    );
    if (leakedLazyCssRe.test(htmlSource)) {
        throw new Error(
            "Lazy-chunk CSS leaked into boot index.html — stripEagerLazyCss matched nothing (did Vite change <link> output?)."
        );
    }
}

/**
 * Fail the build if the eager boot JS exceeds {@link EAGER_JS_BUDGET_GZIP}.
 *
 * "Eager" = the transitive static-import closure from the entry script. We walk
 * it from disk instead of trusting the `<link rel=modulepreload>` list, which
 * the `modulePreload` filter strips lazy chunks from — a static `import` still
 * fetches the target on boot, so the preload list under-reports.
 */
// Static module specifiers that ship on boot: `import ... from "./x.js"`, bare
// `import "./x.js"`, and `export ... from "./x.js"` re-exports. The leading
// non-identifier boundary (`[^\w$]`) anchors the keyword as a statement — it
// covers `;`/`}`/newline separation (rolldown emits imports newline-separated,
// no semicolons) without matching identifiers like `myimport`. The optional
// `from` clause excludes dynamic `import("./x.js")`; `"\./"` excludes the
// `"assets/*.js"` preload-helper dep arrays.
const STATIC_IMPORT_RE =
    /(?:^|[^\w$])(?:import|export)\s*(?:[^"';]*from\s*)?"\.\/([^"]+\.js)"/g;

function collectEagerClosure(dir: string, entries: string[]) {
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
        for (const m of code.toString("utf-8").matchAll(STATIC_IMPORT_RE)) {
            const dep = `assets/${m[1]}`;
            if (!eager.has(dep)) stack.push(dep);
        }
    }
    return eager;
}

function assertEagerBundleBudget() {
    const scriptRe = /<script\b[^>]*\bsrc="[^"]*?(assets\/[^"]+\.js)"/g;

    return {
        name: "assert-eager-bundle-budget",
        apply: "build" as const,
        // writeBundle (post-write) so the final, fully-transformed index.html and
        // every chunk are on disk — avoids in-memory bundle timing/encoding edge
        // cases where the emitted HTML asset isn't yet a string in generateBundle.
        writeBundle(options: { dir?: string }) {
            const dir = options.dir;
            if (!dir) return;

            let htmlSource: string;
            try {
                htmlSource = readFileSync(
                    path.join(dir, "index.html"),
                    "utf-8"
                );
            } catch {
                return;
            }

            assertNoLazyCssLeak(htmlSource);

            const entries: string[] = [];
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
            console.log(
                `\n[eager-budget] boot JS: ${totalKb} KB gz across ${eager.size} chunks (limit ${EAGER_JS_BUDGET_GZIP / 1024} KB)`
            );
            if (totalGzip > EAGER_JS_BUDGET_GZIP) {
                throw new Error(
                    `Eager boot JS budget exceeded: ${totalKb} KB gz > ${EAGER_JS_BUDGET_GZIP / 1024} KB.\n${breakdown
                        .sort()
                        .join("\n")}`
                );
            }
        },
    };
}

export default defineConfig(async () => {
    const sandboxEnv = await getSandboxEnv();

    return {
        base: "/listener",
        css: lightningCssConfig,
        resolve: {
            // CRITICAL: Use production conditions for tree shaking!
            // "development" loads full dev builds with debugging code
            conditions:
                process.env.NODE_ENV === "production"
                    ? ["production", "default"]
                    : ["development"],
            tsconfigPaths: true,
            alias: [
                { find: /^@tauri-apps\/.*$/, replacement: tauriStub },
                { find: /^tauri-plugin-.*$/, replacement: tauriStub },
                // Override @preact/preset-vite defaults with absolute paths so
                // workspace packages (wallet-shared, design-system, ui) resolve
                // correctly under Bun's per-package node_modules layout.
                // Listener installs preact directly; absolute paths sidestep
                // bare-specifier resolution from sibling workspace packages.
                {
                    find: /^preact$/,
                    replacement: path.resolve(__dirname, "node_modules/preact"),
                },
                { find: /^preact\/compat$/, replacement: preactCompat },
                {
                    find: /^preact\/compat\/client$/,
                    replacement: preactCompatClient,
                },
                {
                    find: /^preact\/jsx-runtime$/,
                    replacement: preactJsxRuntime,
                },
                {
                    find: /^preact\/hooks$/,
                    replacement: path.resolve(
                        __dirname,
                        "node_modules/preact/hooks"
                    ),
                },
                // React shim: aliased to preact/compat so existing
                // `import ... from "react"` keeps working unchanged.
                { find: /^react$/, replacement: preactCompat },
                { find: /^react-dom$/, replacement: preactCompat },
                {
                    find: /^react-dom\/client$/,
                    replacement: preactCompatClient,
                },
                { find: /^react\/jsx-runtime$/, replacement: preactJsxRuntime },
                {
                    find: /^react\/jsx-dev-runtime$/,
                    replacement: preactJsxRuntime,
                },
                // Zustand dedupe (see `zustandRoot` above). Explicit subpath
                // aliases cover every specifier used in the graph: app code
                // (`zustand`, `zustand/react`, `zustand/react/shallow`,
                // `zustand/middleware`, `zustand/vanilla`) and @wagmi/core
                // (`zustand/vanilla`, `zustand/middleware`).
                {
                    find: /^zustand$/,
                    replacement: path.join(zustandRoot, "index.mjs"),
                },
                {
                    find: /^zustand\/vanilla$/,
                    replacement: path.join(zustandRoot, "vanilla.mjs"),
                },
                {
                    find: /^zustand\/middleware$/,
                    replacement: path.join(zustandRoot, "middleware.mjs"),
                },
                {
                    find: /^zustand\/react$/,
                    replacement: path.join(zustandRoot, "react.mjs"),
                },
                {
                    find: /^zustand\/react\/shallow$/,
                    replacement: path.join(zustandRoot, "react/shallow.mjs"),
                },
            ],
        },
        define: {
            "process.env.STAGE": JSON.stringify(getSstResource("STAGE")),
            "process.env.BACKEND_URL": JSON.stringify(
                sandboxEnv.backendUrl ?? getSstResource("BACKEND_URL")
            ),
            "process.env.ERPC_URL": JSON.stringify(getSstResource("ERPC_URL")),
            "process.env.DRPC_API_KEY": JSON.stringify(
                getSstResource("DRPC_API_KEY")
            ),
            "process.env.PIMLICO_API_KEY": JSON.stringify(
                getSstResource("PIMLICO_API_KEY")
            ),
            "process.env.NEXUS_RPC_SECRET": JSON.stringify(
                getSstResource("NEXUS_RPC_SECRET")
            ),
            "process.env.DEBUG": JSON.stringify(DEBUG),
            "process.env.FRAK_WALLET_URL": JSON.stringify(
                sandboxEnv.walletUrl ?? getSstResource("FRAK_WALLET_URL")
            ),
            "process.env.OPEN_PANEL_API_URL": JSON.stringify(
                getSstResource("OPEN_PANEL_API_URL")
            ),
            "process.env.OPEN_PANEL_LISTENER_CLIENT_ID": JSON.stringify(
                getSstResource("OPEN_PANEL_LISTENER_CLIENT_ID")
            ),
            "process.env.WEBAUTHN_RP_ID": JSON.stringify(
                process.env.WEBAUTHN_RP_ID
            ),
            "process.env.ANDROID_SHA256_FINGERPRINT": JSON.stringify(
                getSstResource("ANDROID_SHA256_FINGERPRINT")
            ),
            "process.env.DEEP_LINK_SCHEME": JSON.stringify(deepLinkScheme),
            // Build-time platform constants consumed by
            // `packages/app-essentials/src/utils/platform.ts`. Listener never runs in Tauri,
            // so all three are hard-coded to `false`. Rolldown's `inlineConst` propagates
            // them, dead-code-eliminating every `if (IS_TAURI)` branch and its transitive
            // `@tauri-apps/*` dynamic imports out of the bundle.
            __IS_TAURI__: "false",
            __IS_IOS__: "false",
            __IS_ANDROID__: "false",
            "process.env.OPEN_PANEL_WALLET_CLIENT_ID": "undefined",
            "process.env.APP_VERSION": "undefined",
        },
        plugins: [
            preact({ reactAliasesEnabled: false }),
            vanillaExtractPlugin(),
            // Inline Inter @font-face. No `preload` on purpose: the iframe
            // boots with no UI, so the woff2 must load lazily with Ring 1.
            inlineFontFaces({ cssFiles: ["app/fonts/inter.css"] }),
            ...(isSandbox ? [] : [mkcert()]),
            ...(isProd ? [removeConsole()] : []),
            stripOrphanCrossChunkImports(),
            stripEagerLazyCss(),
            assertEagerBundleBudget(),
        ],
        server: {
            port: 3002,
            proxy: {},
            allowedHosts: isSandbox ? true : undefined,
        },
        // Mirrors `server` so `vite preview` (used by `dev:built`)
        // is reachable on the same HTTPS host:port the wallet dev
        // proxy targets (`https://localhost:3002`). Keeps the iframe
        // URL identical between dev mode and built-bundle mode.
        preview: {
            port: 3002,
            allowedHosts: isSandbox ? true : undefined,
        },
        build: {
            cssCodeSplit: true,
            // Vite eagerly emits `<link rel="modulepreload">` tags for every
            // chunk reachable from the entry — including those reached only
            // via dynamic imports. That defeats the lazy-loading effort:
            // the modal/embedded-wallet bundles (and the heavy blockchain
            // graph they pull) end up downloaded on iframe boot just to be
            // ready when the user eventually opens a modal. Restrict the
            // HTML preload list to the chunks the iframe actually needs
            // before any user interaction. Runtime preloading via
            // `__vitePreload` (used when modal/wallet actually mounts) is
            // unaffected.
            modulePreload: {
                resolveDependencies: (_filename, deps, { hostType }) => {
                    if (hostType !== "html") return deps;
                    const lazyDepRe = new RegExp(
                        `(?:${LAZY_CHUNK_ALTERNATION})-`
                    );
                    return deps.filter((d) => !lazyDepRe.test(d));
                },
            },
            target: "baseline-widely-available",
            // Coarse per-chunk warning only: kept just above the largest legit
            // lazy chunk (blockchain-vendor ~285 KB) to avoid routine noise on
            // intentionally heavy lazy chunks. The KPI that matters — the eager
            // boot path — is enforced as a hard build failure by
            // `assertEagerBundleBudget`, not by this number.
            chunkSizeWarningLimit: 300,
            rolldownOptions: {
                // Skip emitting facade chunks for dynamic-import entry points.
                // Combined with `includeDependenciesRecursively: false`, this lets
                // Rolldown route `@/ui/runtime` directly to the `ui-runtime` chunk
                // instead of creating a 73-byte re-export shim.
                preserveEntrySignatures: false,
                experimental: {
                    attachDebugInfo: isProd ? "none" : "full",
                    lazyBarrel: true,
                },
                // Enable aggressive tree shaking
                treeshake: {
                    moduleSideEffects: "no-external", // External packages (node_modules) have no side effects
                    propertyReadSideEffects: false, // Reading properties doesn't cause side effects
                },
                optimization: {
                    // This will to remove some stuff that will be defined, like stage depend variable
                    inlineConst: { mode: "all", pass: 3 },
                },
                output: {
                    codeSplitting: {
                        // Only chunk stuff shared by at least 2 modules
                        minShareCount: 2,
                        groups: [
                            // NOTE: Rolldown's `\0rolldown/runtime.js` is emitted
                            // as its own hardcoded `rolldown-runtime` chunk by the
                            // native core — user-defined `codeSplitting.groups`
                            // cannot redirect it (verified empirically). That tiny
                            // chunk (~0.8 KB) therefore remains separate.
                            //
                            // `vite/preload-helper` (1.2 KB) used to be pinned to
                            // its own chunk; the wider `common` regex below claims
                            // it now, saving an HTTP request without dragging lazy
                            // chunks into eager (common is the only static dependency
                            // root the preload helper has).
                            // ============================================
                            // EAGER chunks (loaded on every iframe boot)
                            // ============================================
                            //
                            // Goal: keep the request count low for partner
                            // sites. We collapse react / i18n / tanstack /
                            // misc-eager-node_modules into a single `vendor`
                            // chunk — the marginal caching gain from finer
                            // splits doesn't justify the extra HTTP requests
                            // visible in partner network tabs.
                            // ui-runtime hosts everything Preact/React-ish:
                            // preact, i18next, react-i18next, @tanstack/react-query,
                            // plus the listener's own provider tree (`app/ui/`).
                            // It is pulled in dynamically the first time a
                            // partner site triggers UI — NOT tagged $initial.
                            // Higher priority than `vendor` so its rule wins for
                            // node_modules that match both regexes.
                            {
                                name: "ui-runtime",
                                // Only the React-bindings live here (lazy).
                                // The headless @tanstack/query-* libs are
                                // imported eagerly by `app/queryClient.ts` and
                                // therefore moved to `vendor`. If `@tanstack`
                                // is matched broadly here, the eager entry is
                                // forced to statically import this whole
                                // chunk, defeating the lazy strategy.
                                test: /(?:node_modules[\\/](?:preact|i18next|i18next-browser-languagedetector|react-i18next|@tanstack[\\/]react-query|@tanstack[\\/]react-query-persist-client)[\\/])|(?:node_modules[\\/]zustand[\\/]esm[\\/]react(?:[\\/]|\.mjs))|(?:apps[\\/]listener[\\/]app[\\/](?:ui[\\/]|module[\\/]hooks[\\/]useListenerDataPreload))|(?:packages[\\/]wallet-shared[\\/]src[\\/](?:i18n[\\/]config|common[\\/](?:hook[\\/]useGetSafeSdkSession|queryKeys[\\/]sdk)))/,
                                priority: 45,
                                minShareCount: 1,
                            },

                            // `vendor` keeps Ring-0-eager runtime libs:
                            // zustand stores, idb-keyval, elysia client,
                            // clsx, nanoid, and the headless @tanstack/query-*
                            // libs that the eager `queryClient.ts` needs.
                            {
                                name: "vendor",
                                // tags omitted on purpose: marking $initial
                                // makes Rolldown reject shared-with-lazy modules
                                // (verified: @tanstack/query-core, zustand, etc.
                                // would otherwise fall through to ui-runtime).
                                test: /node_modules[\\/](?:zustand|idb-keyval|nanoid|@elysiajs|clsx|@tanstack[\\/](?:query-core|query-async-storage-persister|query-persist-client-core))[\\/]/,
                                priority: 40,
                                // CRITICAL: must be 1, otherwise the global
                                // `minShareCount: 2` keeps single-entry node_modules
                                // inside the `index` entry chunk instead of vendor.
                                minShareCount: 1,
                            },

                            // ============================================
                            // LAZY chunks (loaded on first UI display)
                            // ============================================
                            //
                            // • `blockchain-vendor` → viem + wagmi +
                            //   permissionless + BaseProvider + provider glue.
                            //   Modal/Wallet only.
                            // • `ui-vendor` → heavy lazy UI libs (@radix-ui,
                            //   qr, micromark). radix + alert-dialog are
                            //   Modal-only; qr + micromark land here through
                            //   wallet-shared pairing/Markdown which Modal+Wallet
                            //   share. SharingPage pulls @radix-ui/react-accordion
                            //   via design-system Accordion (FAQ section).
                            // • `lazy-shared` → design-system + sonner +
                            //   lucide + listener shared components +
                            //   Toast/Markdown/etc + pairing UI. Pulled by
                            //   any lazy boundary that needs UI primitives.
                            //   `minShareCount: 1` ensures it materialises
                            //   even when only one boundary uses a given file.
                            //
                            // SharingPage skips `blockchain-vendor` and the
                            // heavy `ui-vendor` — only `lazy-shared` is fetched
                            // on first display.
                            {
                                name: "blockchain-vendor",
                                test: /(?:node_modules[\\/](?:viem|wagmi|@wagmi|permissionless|@noble|@scure|ox|abitype|radash|mipd|eventemitter3)[\\/])|(?:packages[\\/]app-essentials[\\/]src[\\/](?:blockchain|webauthn))|(?:wallet-shared[\\/]src[\\/](?:providers[\\/]BaseProvider|wallet[\\/]|blockchain[\\/]|authentication[\\/]webauthn[\\/]tauriBridge))/,
                                priority: 35,
                                // CRITICAL: must be 1 so viem's dynamically
                                // imported subtree (ccip OffchainLookup errors)
                                // lands here instead of its own chunk.
                                minShareCount: 1,
                            },
                            {
                                name: "ui-vendor",
                                test: /node_modules[\\/](?:@radix-ui|micromark|qr)[\\/]/,
                                priority: 30,
                            },
                            {
                                name: "lazy-shared",
                                test: /(?:node_modules[\\/](?:sonner|lucide-react|use-sync-external-store|@vanilla-extract)[\\/])|(?:packages[\\/]design-system[\\/])|(?:wallet-shared[\\/]src[\\/](?:(?:common|pairing)[\\/]component|common[\\/](?:hook[\\/](?:useCopyToClipboardWithState|useFormattedEstimatedReward)|utils[\\/]openExternalUrl)|sharing|pairing[\\/](?:clients|types)))|(?:sdk[\\/]core[\\/]src[\\/](?:context|types[\\/]context))|(?:apps[\\/]listener[\\/]app[\\/]module[\\/](?:component[\\/](?:SsoButton|ToastLoading)|stores[\\/]hooks|utils[\\/](?:resolveBackendMetadata|normalizeTargetInteraction|deprecatedModalMetadataMapper)|hooks[\\/](?:useTrackSharing|useDisplaySharingPageListener\.impl)|sharing[\\/]component))/,
                                priority: 25,
                                minShareCount: 1,
                            },
                            // No explicit Modal/Wallet group: default chunking
                            // emits a single chunk per dynamic-import boundary
                            // (Modal/index.tsx and Wallet/index.tsx). Each
                            // boundary now re-exports its lazy handler body
                            // (handleDisplayModal / handleDisplayEmbeddedWallet)
                            // from useDisplay*.impl so the impl modules land in
                            // the same default chunk as their parent component
                            // tree — collapsing the previous 1-2 KB shim chunks.
                            // (i18n locale chunking is implicit — the per-language
                            // barrel module `wallet-shared/i18n/locales/{en,fr}`
                            // is the single dynamic-import target. Both bundled
                            // JSONs are reachable only through it, so Rolldown's
                            // default chunking emits exactly one chunk per
                            // language without an explicit group.)
                            //
                            // NOTE: `WalletAddress` and `ButtonAuth` are
                            // Modal-only (verified via importer audit) and
                            // pulled `viem.slice` (WalletAddress) +
                            // `lucide-react.Fingerprint` (ButtonAuth) into
                            // `lazy-shared` — forcing every lazy flow,
                            // including SharingPage, to load
                            // `blockchain-vendor`. They are now allowed to
                            // fall into the Modal chunk via default chunking.
                            // SharingPage no longer fetches blockchain-vendor.

                            // ============================================
                            // SHARED-WITH-LAZY (eager) chunk
                            // ============================================
                            //
                            // Workspace utilities reachable from BOTH the
                            // eager entry and the lazy chunks (Zustand stores,
                            // analytics, api client, i18n config, app-essentials,
                            // pairing clients, etc.). `tags: ['$initial']`
                            // ensures only modules statically reachable from
                            // accidentally drift in.
                            //
                            // CRITICAL: priority MUST be higher than EVERY lazy
                            // group. Otherwise `includeDependenciesRecursively`
                            // lets a higher-priority lazy group recursively claim
                            // these eager `$initial` modules, forcing the entry to
                            // static-import the lazy chunk to get them back and
                            // dragging it onto iframe boot. `$initial` keeps this
                            // group from stealing genuinely lazy members.
                            {
                                name: "common",
                                // `$initial` keeps lazy-only workspace files
                                // (pairing clients/hooks, identity, listener
                                // hook .impl chunks) out of this chunk — they
                                // belong in `lazy-shared` / their boundary chunk.
                                tags: ["$initial"],
                                test: /(?:vite[\\/](?:dist[\\/])?preload-helper)|(?:wallet-shared[\\/]src[\\/](?:stores|i18n|polyfills|stubs|types|pairing[\\/]types|common[\\/](?:analytics|api|lib|utils|storage|tauri|queryKeys)|common[\\/]hook[\\/](?:useEstimatedReward|useGetSafeSdkSession)))|(?:packages[\\/]app-essentials[\\/])|(?:packages[\\/]rpc[\\/](?:dist|src)[\\/])|(?:sdk[\\/]core[\\/]src[\\/])|(?:apps[\\/]listener[\\/]app[\\/](?:uiBus|queryClient|i18nOverrideQueue)\.ts)|(?:apps[\\/]listener[\\/]app[\\/]module[\\/](?:stores|middleware|handlers|providers|types|common|queryKeys|utils[\\/](?:i18nMapper|deprecatedModalMetadataMapper|normalizeTargetInteraction|backup)|hooks[\\/](?:useDisplayEmbeddedWallet(?!\.impl)|useDisplayModalListener(?!\.impl)|useDisplaySharingPageListener(?!\.impl)|useOnGet|useSendInteraction(?!Listener\.)|useSendInteractionListener|useUserReferralStatus|useWalletStatusListener|useSsoLink)))/,
                                priority: 50,
                                // Single-importer modules must still land here
                                // (e.g. wallet-shared/common/api/backendClient.ts
                                // is only reached via the eager api hooks).
                                minShareCount: 1,
                            },
                        ],
                    },
                },
                onwarn,
            },
            sourcemap: !isProd,
        },
    } satisfies UserConfig;
});
