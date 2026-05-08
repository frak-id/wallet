import * as path from "node:path";
import * as process from "node:process";
import { fileURLToPath } from "node:url";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react";
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
        /import\s*"\.\/blockchain-vendor-[A-Za-z0-9_-]+\.js";/g;
    return {
        name: "strip-orphan-blockchain-vendor-import",
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
            "process.env.APP_VERSION": JSON.stringify(
                process.env.COMMIT_HASH ?? "UNKNOWN"
            ),
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
        },
        plugins: [
            react(),
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
                            !/(?:blockchain-vendor|BaseProvider|Modal|Wallet|SharingPage|ccip|secp256k1)-/.test(
                                d
                            )
                    );
                },
            },
            target: "baseline-widely-available",
            chunkSizeWarningLimit: 300,
            rolldownOptions: {
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
                            // Without this group it gets hoisted into the largest
                            // shared chunk — in our case `blockchain-vendor` — which
                            // forces the eager iframe entry to statically import
                            // that chunk just to get the dynamic-import wrapper.
                            // Pinning it to its own tiny chunk keeps the heavy
                            // blockchain code fully lazy.
                            {
                                name: "vite-preload",
                                test: /vite[\\/]preload-helper/,
                                priority: 50,
                            },

                            // React ecosystem - React + React-DOM + scheduler
                            {
                                name: "react-vendor",
                                test: /node_modules[\\/](react|react-dom|react[\\/]jsx-runtime)/,
                                priority: 40,
                            },

                            // Blockchain libraries — viem (incl. account-abstraction),
                            // wagmi, permissionless, and their crypto deps. Now lazy-only:
                            // pulled by the modal + embedded-wallet chunks via
                            // `BlockchainProvider`.
                            //
                            // The regex also captures wallet-shared's blockchain-adjacent
                            // code (smart wallet, providers/BaseProvider, blockchain/*)
                            // so it lands in this lazy vendor chunk instead of being
                            // hoisted into `common` (which is statically imported by
                            // the eager iframe bundle and would otherwise drag the
                            // whole wagmi graph in eagerly).
                            {
                                name: "blockchain-vendor",
                                test: /(?:node_modules[\\/](?:viem|wagmi|@wagmi|permissionless|@noble|@scure|ox))|(?:wallet-shared[\\/]src[\\/](?:providers[\\/]BaseProvider|wallet[\\/]|blockchain[\\/]))/,
                                priority: 35,
                            },

                            // TanStack libraries - React Query
                            {
                                name: "tanstack-vendor",
                                test: /node_modules[\\/]@tanstack/,
                                priority: 32,
                            },

                            // UI vendors - ALL UI libraries together
                            {
                                name: "ui-vendor",
                                test: /node_modules[\\/](@radix-ui|vaul|micromark|sonner|lucide-react|class-variance-authority|cuer|nprogress|react-hook-form|react-dropzone)/,
                                priority: 30,
                            },

                            // All the other elements shared within the codebase
                            {
                                name: "lazy-shared",
                                test: /(?:wallet-shared[\\/]src[\\/]common[\\/]component)|(?:apps[\\/]listener[\\/]app[\\/]module[\\/](?:component|utils[\\/](?:i18nMapper|deprecatedModalMetadataMapper|resolveBackendMetadata)))/,
                                priority: 11,
                            },
                            {
                                name: "common",
                                priority: 10,
                            },
                        ],
                    },
                },
                onwarn,
            },
            sourcemap: false,
        },
    } satisfies UserConfig;
});
