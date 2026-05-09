import * as path from "node:path";
import * as process from "node:process";
import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import type { UserConfig } from "vite";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import removeConsole from "vite-plugin-remove-console";
import {
    getSandboxEnv,
    getSstResource,
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

const DEBUG = JSON.stringify(false);

const isProd = process.env.STAGE?.includes("prod") ?? false;
const isSandbox = !!process.env.ATELIER_SANDBOX_ID;

// Mobile deep-link scheme — must match the wallet variant the listener pairs with:
// prod listener (wallet.frak.id) opens the prod wallet (id.frak.wallet) via frakwallet://,
// dev listener (wallet-dev.frak.id) opens the dev wallet (id.frak.wallet.dev) via frakwallet-dev://.
const deepLinkScheme = isProd ? "frakwallet://" : "frakwallet-dev://";

/**
 * Rolldown emits a side-effect-only `import "./blockchain-vendor-*.js";` at the
 * top of `common-*.js` even though no symbols from that chunk are bound and
 * `bundle-stats` shows zero real edges. This appears to be a chunking artifact:
 * once viem/wagmi land in their own vendor chunk while the dynamic-import
 * boundary (BlockchainProvider) lives in a chunk reachable from the eager entry,
 * Rolldown preserves a static evaluation-order import "just in case".
 *
 * Effect on the iframe: the browser fetches blockchain-vendor.js (~52 KB gz)
 * on cold boot even though the modulePreload filter strips it from the HTML.
 * That defeats the entire lazy-blockchain effort.
 *
 * The bound dynamic import (`__vitePreload(() => import('./BaseProvider...'))`)
 * is preserved by this plugin — only the orphan side-effect import statement is
 * removed.
 */
function stripOrphanCrossChunkImports() {
    const ORPHAN_IMPORT_RE =
        /^import\s*"\.\/(?:blockchain-vendor|BaseProvider|ui-vendor|ui-runtime|lazy-shared|Modal|Wallet|SharingPage)-[A-Za-z0-9_-]+\.js";\n?/gm;
    return {
        name: "strip-orphan-cross-chunk-imports",
        apply: "build" as const,
        generateBundle(_options: unknown, bundle: Record<string, unknown>) {
            for (const file of Object.values(bundle)) {
                const f = file as {
                    type?: string;
                    fileName?: string;
                    code?: string;
                };
                if (f.type !== "chunk" || !f.fileName?.includes("common-")) {
                    continue;
                }
                if (typeof f.code === "string") {
                    f.code = f.code.replace(ORPHAN_IMPORT_RE, "");
                }
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
            "process.env.IS_APP_AVAILABLE": JSON.stringify(
                process.env.IS_APP_AVAILABLE ?? "true"
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
            ...(isSandbox ? [] : [mkcert()]),
            ...(isProd ? [removeConsole()] : []),
            stripOrphanCrossChunkImports(),
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
                    return deps.filter(
                        (d) =>
                            !/(?:blockchain-vendor|BaseProvider|Modal|Wallet|SharingPage|ccip|secp256k1|lazy-shared|ui-vendor|ui-runtime)-/.test(
                                d
                            )
                    );
                },
            },
            target: "baseline-widely-available",
            chunkSizeWarningLimit: 300,
            rolldownOptions: {
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
                            // Vite's `__vitePreload` helper (virtual module).
                            // Pinned to its own tiny chunk (1.2 KB) so it doesn't
                            // get hoisted into a heavy lazy chunk — if that
                            // happens the eager entry statically imports that
                            // chunk just to obtain the dynamic-import wrapper.
                            // (Tested: removing this group hoists the helper into
                            // `blockchain-vendor` and drags 165 KB into eager.)
                            //
                            // NOTE: Rolldown's `\0rolldown/runtime.js` is emitted
                            // as its own hardcoded `rolldown-runtime` chunk by the
                            // native core — user-defined `codeSplitting.groups`
                            // cannot redirect it (verified empirically). The two
                            // tiny runtime chunks (~0.7 KB + ~1.2 KB) therefore
                            // remain separate.
                            {
                                name: "vite-preload",
                                test: /vite[\\/]preload-helper/,
                                priority: 50,
                            },

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
                                test: /(?:node_modules[\\/](?:preact|i18next|i18next-browser-languagedetector|react-i18next|@tanstack)[\\/])|(?:apps[\\/]listener[\\/]app[\\/]ui[\\/])/,
                                priority: 45,
                                minShareCount: 1,
                            },

                            // `vendor` keeps only Ring-0-eager runtime libs:
                            // zustand stores, idb-keyval, nanoid, elysia client,
                            // clsx. Everything React-ish moved to `ui-runtime`.
                            {
                                name: "vendor",
                                tags: ["$initial"],
                                test: /node_modules[\\/](?:zustand|idb-keyval|nanoid|@elysiajs|clsx)[\\/]/,
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
                                test: /(?:node_modules[\\/](?:viem|wagmi|@wagmi|permissionless|@noble|@scure|ox))|(?:wallet-shared[\\/]src[\\/](?:providers[\\/]BaseProvider|wallet[\\/]|blockchain[\\/]))/,
                                priority: 35,
                            },
                            {
                                name: "ui-vendor",
                                test: /node_modules[\\/](?:@radix-ui|micromark|qr)[\\/]/,
                                priority: 30,
                            },
                            {
                                name: "lazy-shared",
                                test: /(?:node_modules[\\/](?:sonner|lucide-react)[\\/])|(?:packages[\\/]design-system[\\/])|(?:wallet-shared[\\/]src[\\/](?:(?:common|pairing)[\\/]component|common[\\/]hook[\\/]useCopyToClipboardWithState|sharing))|(?:apps[\\/]listener[\\/]app[\\/]module[\\/](?:component[\\/](?:SsoButton|ToastLoading)|stores[\\/]hooks|utils[\\/](?:resolveBackendMetadata|normalizeTargetInteraction)|hooks[\\/]useTrackSharing))/,
                                priority: 25,
                                minShareCount: 1,
                            },
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
                            // CRITICAL: priority MUST be higher than `lazy-shared`.
                            // Otherwise Rolldown's default
                            // `includeDependenciesRecursively: true` lets
                            // `lazy-shared` claim eager modules (e.g.
                            // ListenerUiProvider) that lazy boundaries reach
                            // via shared hooks (useSharingListenerUI etc.),
                            // forcing the entry to statically import the lazy
                            // chunk to get back its own Provider.
                            {
                                name: "common",
                                tags: ["$initial"],
                                test: /(?:wallet-shared[\\/]src[\\/](?:stores|i18n|polyfills|stubs|identity|types|pairing[\\/](?:clients|hook|queryKeys|types)|common[\\/](?:analytics|api|hook|lib|utils)))|(?:packages[\\/]app-essentials[\\/])|(?:apps[\\/]listener[\\/]app[\\/]module[\\/](?:stores|middleware|handlers|providers|types|common|queryKeys|hooks|utils[\\/](?:i18nMapper|deprecatedModalMetadataMapper|normalizeTargetInteraction|backup)))/,
                                priority: 28,
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
