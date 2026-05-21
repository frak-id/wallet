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
    const LAZY_ORPHAN_RE =
        /import\s*"\.\/(?:blockchain-vendor|BaseProvider|ui-vendor|ui-runtime|lazy-shared|Modal|Wallet|SharingPage)-[A-Za-z0-9_-]+\.js";/g;
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
                    // TODO: Lazy bundle leaking into eager ones, we removed `includeDependenciesRecursively: false` that was causing issue in some chunks.
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
                                // `$initial` keeps lazy-only workspace files
                                // (pairing clients/hooks, identity, listener
                                // hook .impl chunks) out of this chunk — they
                                // belong in `lazy-shared` / their boundary chunk.
                                tags: ["$initial"],
                                test: /(?:vite[\\/](?:dist[\\/])?preload-helper)|(?:wallet-shared[\\/]src[\\/](?:stores|i18n|polyfills|stubs|types|pairing[\\/]types|common[\\/](?:analytics|api|lib|utils|storage|tauri|queryKeys)|common[\\/]hook[\\/](?:useEstimatedReward|useGetSafeSdkSession)))|(?:packages[\\/]app-essentials[\\/])|(?:packages[\\/]rpc[\\/](?:dist|src)[\\/])|(?:sdk[\\/]core[\\/]src[\\/])|(?:apps[\\/]listener[\\/]app[\\/](?:uiBus|queryClient|i18nOverrideQueue)\.ts)|(?:apps[\\/]listener[\\/]app[\\/]module[\\/](?:stores|middleware|handlers|providers|types|common|queryKeys|utils[\\/](?:i18nMapper|deprecatedModalMetadataMapper|normalizeTargetInteraction|backup)|hooks[\\/](?:useDisplayEmbeddedWallet(?!\.impl)|useDisplayModalListener(?!\.impl)|useDisplaySharingPageListener(?!\.impl)|useOnGet|useSendInteraction(?!Listener\.)|useSendInteractionListener|useUserReferralStatus|useWalletStatusListener|useSsoLink)))/,
                                priority: 28,
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
