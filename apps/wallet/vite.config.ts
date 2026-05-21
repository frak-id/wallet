import * as path from "node:path";
import * as process from "node:process";
import { fileURLToPath } from "node:url";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import viteReact from "@vitejs/plugin-react";
import type { ConfigEnv, UserConfig } from "vite";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import removeConsole from "vite-plugin-remove-console";
import {
    getSandboxEnv,
    getSstResource,
    inlineFontFaces,
    lightningCssConfig,
    onwarn,
    stripAbiInternalType,
} from "../../packages/dev-tooling";
import walletPackage from "./package.json";

const DEBUG = JSON.stringify(false);

const isProd = process.env.STAGE?.includes("prod") ?? false;
const isTauri = !!process.env.TAURI_CLI_RUNNING;
// Tauri 2 sets `TAURI_ENV_PLATFORM` for hook commands (`ios`, `android`, `darwin`, `linux`, `windows`).
// Combined with `TAURI_CLI_RUNNING`, lets us hard-code platform booleans per Tauri target build,
// so the iOS bundle drops Android-only code and vice-versa.
const tauriPlatform = process.env.TAURI_ENV_PLATFORM;
const isTauriIos = isTauri && tauriPlatform === "ios";
const isTauriAndroid = isTauri && tauriPlatform === "android";
const isSandbox = !!process.env.ATELIER_SANDBOX_ID;
const appVersion = process.env.COMMIT_HASH ?? walletPackage.version;
// Web stays strict at 300 KB to surface regressions early; Tauri allows
// 500 KB since assets ship in the binary (no network cost) and the
// `blockchain-vendor` chunk runs close to the limit.
const chunkSizeWarningLimit = isTauri ? 500 : 300;
// Drop Rolldown debug info in prod (smaller maps), keep full in dev.
const attachDebugInfo: "full" | "none" = isProd ? "none" : "full";

// Routes whose only purpose is to host nested child routes via `<Outlet/>`.
// They look like leaf routes from `routeId` alone, but their files are
// 9-line layout shells. Listed explicitly so TanStack Router's
// `autoCodeSplitting` skips them — saves one ~210 B lazy chunk per route.
// Verify with: `rg '<Outlet ?/>' apps/wallet/app/routes`.
const PURE_OUTLET_PARENT_ROUTES = new Set([
    "/_wallet/_protected/wallet",
    "/_wallet/_protected/profile",
    "/_wallet/_protected/settings",
    "/_wallet/_protected-fullscreen/profile/referral",
]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Build-time stub that swaps every `@tauri-apps/*` and `tauri-plugin-*`
// runtime path with a no-op module on the web build. Every call site is
// dead under `IS_TAURI = false`, so the stub keeps the actual `invoke` /
// `transformCallback` runtime out of the chunk graph. Skipped in Tauri
// builds where the real packages must be loaded.
const tauriStub = path.resolve(
    __dirname,
    "../../packages/wallet-shared/src/stubs/tauri-noop.ts"
);

// Tauri-only path: the real packages must remain reachable. On the web build,
// alias them to the no-op stub so Rolldown drops the runtime out of the chunk
// graph.
const tauriAlias = isTauri
    ? []
    : [
          { find: /^@tauri-apps\/.*$/, replacement: tauriStub },
          { find: /^tauri-plugin-.*$/, replacement: tauriStub },
      ];

// Code-splitting groups for Rolldown. Same shape for web and Tauri.
//
// Tauri's `tauri://` protocol handler is faster than HTTP/2+CDN per asset
// (1–5 ms local fs read vs network round-trip), so saving JS parse/compile
// cost on unused routes outweighs the extra fetch overhead. The granular
// vendor split costs nothing on Tauri (no cross-deploy cache benefit) but
// matches the web cache strategy and keeps a single source of truth.
//
// Routes are autoCodeSplit by TanStack Router but immediately re-grouped by
// manual `feature-*` groups so each navigation pulls one logical chunk
// instead of 5–10 tiny ones (Skeleton, hooks, queryKeys, route component, ...).
//
// `tags: ["$initial"]` on `app-shell` filters to modules statically reachable
// from `main.tsx` — without it, modules shared between bootstrap and lazy
// route components leak into feature chunks and force the entry to static-
// import them, defeating lazy loading entirely.
//
// `common-lazy` deliberately omits the tag so the lazy-shared tail (Skeleton,
// queryKeys constants, small hooks) collapses into one chunk instead of
// auto-emitting a sub-1 KB chunk per module.
function buildChunkGroups() {
    return [
        // Vendor split — stable libraries first for long-term browser cache.
        {
            name: "react-vendor",
            test: /node_modules[\\/](react|react-dom|scheduler|react[\\/]jsx-runtime)[\\/]/,
            priority: 40,
            minShareCount: 1,
        },
        // Tanstack-vendor BEFORE blockchain-vendor: when wagmi pulls @tanstack/
        // query-core and zustand transitively, bun's content-addressed layout
        // produces paths like `node_modules/.bun/wagmi@x/node_modules/@tanstack/
        // query-core/...` that match BOTH this regex AND the blockchain regex.
        // Higher priority wins (Rolldown), so tanstack-vendor must outrank
        // blockchain-vendor or query-core gets duplicated across both chunks.
        // We also fold zustand here — same state-management family, same leakage
        // pattern: it was previously split between `index` (17KB) and
        // `blockchain-vendor` (15KB) for ~32KB of duplication.
        {
            name: "tanstack-vendor",
            test: /[\\/]node_modules[\\/](?:@tanstack|zustand)[\\/]/,
            priority: 36,
            minShareCount: 1,
        },
        {
            name: "blockchain-vendor",
            test: /[\\/]node_modules[\\/](?:viem|wagmi|@wagmi|permissionless|@noble|@scure|ox)[\\/]/,
            priority: 35,
            minShareCount: 1,
        },
        // Forms vendor — react-hook-form + the underlying `qr` package
        // (used by `wallet-shared/pairing/component/PairingQrCode`). Both are
        // reached only via lazy code paths (recovery routes, tokens.send
        // route, PairingView in lazy auth routes, and the now-lazy Keypass
        // modal in ModalOutlet). Split out from `ui-vendor` because
        // ui-vendor's other members (@radix-ui/vaul/sonner) are eager via the
        // app shell, which dragged forms + qr along when they shared a chunk.
        {
            name: "forms-vendor",
            test: /[\\/]node_modules[\\/](?:react-hook-form|qr)[\\/]/,
            priority: 31,
            minShareCount: 1,
        },
        {
            name: "ui-vendor",
            test: /[\\/]node_modules[\\/](@radix-ui|vaul|micromark|sonner|lucide-react|class-variance-authority|react-dropzone)[\\/]/,
            priority: 30,
            minShareCount: 1,
        },
        // Eager app-shell catch-all. `tags: ["$initial"]` filters to modules
        // statically reachable from `main.tsx` — i.e., everything that has
        // to be parsed before first paint anyway. Without this, modules
        // shared between bootstrap (RootProvider, layouts, route
        // definitions) and lazy route components leak into the feature
        // chunks and force the entry to static-import them, defeating
        // lazy loading entirely.
        {
            name: "app-shell",
            tags: ["$initial"] as "$initial"[],
            priority: 28,
            minShareCount: 1,
        },
        // Shared LAZY app code: small components in `app/module/common/` plus
        // a curated subset of `wallet-shared` (sharing/referral/pairing/identity)
        // used across 2+ feature chunks. MUST sit ABOVE the feature groups in
        // priority — Rolldown's `add_module_and_dependencies_to_group_recursively`
        // pulls every transitive dep of a matched module into that group, so a
        // shared component like `InfoCard` (used by 6 features) ends up swept into
        // the FIRST feature group whose regex matches its importer (e.g.
        // feature-monerium claiming InfoCard via MoneriumConnect). Every other
        // feature then static-imports from that one, turning isolated navigations
        // into multi-chunk fetches.
        //
        // `minShareCount: 2` keeps single-feature internals (e.g. auth-only
        // `Back`/`Password` components) inside their feature chunk; only modules
        // reachable from 2+ entries get hoisted here. `minSize: 0` overrides the
        // global 4KB threshold so even a 3KB shared module emits as its own chunk.
        {
            name: "common-lazy",
            test: /[\\/]app[\\/]module[\\/]common[\\/]|[\\/]packages[\\/]wallet-shared[\\/]src[\\/](?:common|sharing|referral|pairing|identity)[\\/]/,
            priority: 27,
            minShareCount: 2,
            minSize: 0,
        },
        // Feature buckets — truly LAZY chunks, loaded when the user navigates
        // to a route in that family OR opens a heavy modal through `ModalOutlet`.
        // We match BOTH:
        //   • `?tsr-split=*` virtual modules (TanStack Router lazy components)
        //   • `app/module/<name>/` paths reached via dynamic `import()` from
        //     `ModalOutlet` (e.g. MoneriumBankFlow, ExplorerDetail, …)
        // Their transitive dependencies that aren't captured by another group
        // fall into the feature chunk via the auto-chunker, keeping each
        // navigation/modal-open to a single fetch.
        {
            name: "feature-auth",
            test: /[\\/]app[\\/](?:routes[\\/]_wallet[\\/](?:_auth|_sso)[\\/].*\?tsr-split=|module[\\/](?:onboarding|authentication)[\\/])/,
            priority: 25,
            minShareCount: 1,
        },
        {
            name: "feature-wallet",
            test: /[\\/]app[\\/](?:module[\\/](?:wallet|tokens)[\\/]|routes[\\/]_wallet[\\/]_protected[\\/](?:wallet|tokens)[.\\/].*\?tsr-split=)/,
            priority: 24,
            minShareCount: 1,
        },
        // Monerium subtree — entire 12-file flow + REST client + zustand stores.
        // No external SDK; ~70KB of hand-rolled code. Captured here so it lazy-
        // loads when the user opens the bank-flow modal or hits the OAuth callback.
        {
            name: "feature-monerium",
            test: /[\\/]app[\\/](?:module[\\/]monerium[\\/]|routes[\\/]_wallet[\\/]_protected[\\/]monerium\.)/,
            priority: 23,
            minShareCount: 1,
        },
        {
            name: "feature-profile",
            test: /[\\/]app[\\/]routes[\\/]_wallet[\\/]_protected[\\/](?:profile|settings)[.\\/].*\?tsr-split=/,
            priority: 22,
            minShareCount: 1,
        },
        // Referral subtree (module + the fullscreen referral route). Higher
        // priority than `feature-social` so the route ID match wins over the
        // generic `_protected-fullscreen` capture.
        {
            name: "feature-referral",
            test: /[\\/]app[\\/](?:module[\\/]referral[\\/]|routes[\\/]_wallet[\\/]_protected-fullscreen[\\/]profile\.referral)/,
            priority: 21,
            minShareCount: 1,
        },
        // Explorer subtree (module + protected `explorer.*` route). Captured
        // separately so opening the explorer modal pulls a focused ~25KB chunk.
        {
            name: "feature-explorer",
            test: /[\\/]app[\\/](?:module[\\/]explorer[\\/]|routes[\\/]_wallet[\\/]_protected[\\/]explorer\..*\?tsr-split=)/,
            priority: 20,
            minShareCount: 1,
        },
        {
            name: "feature-social",
            test: /[\\/]app[\\/]routes[\\/](?:_wallet[\\/]_protected-fullscreen[\\/]|(?:sharing|install)\.).*\?tsr-split=/,
            priority: 19,
            minShareCount: 1,
        },
        {
            name: "feature-content",
            test: /[\\/]app[\\/](?:module[\\/]history[\\/]|routes[\\/]_wallet[\\/]_protected[\\/](?:history|notifications)\..*\?tsr-split=)/,
            priority: 18,
            minShareCount: 1,
        },
        // (`common-lazy` group is defined above, between app-shell and the feature
        // groups, so its priority outranks every feature.)
    ];
}

async function getDefineProps() {
    const sandboxEnv = await getSandboxEnv();
    return {
        "process.env.STAGE": JSON.stringify(getSstResource("STAGE") ?? "dev"),
        "process.env.BACKEND_URL": JSON.stringify(
            sandboxEnv.backendUrl ??
                getSstResource("BACKEND_URL") ??
                "https://backend.gcp-dev.frak.id"
        ),
        "process.env.ERPC_URL": JSON.stringify(
            getSstResource("ERPC_URL") ??
                "https://erpc.gcp-dev.frak.id/nexus-rpc/evm/"
        ),
        "process.env.DRPC_API_KEY": JSON.stringify(
            getSstResource("DRPC_API_KEY")
        ),
        "process.env.PIMLICO_API_KEY": JSON.stringify(
            getSstResource("PIMLICO_API_KEY")
        ),
        "process.env.NEXUS_RPC_SECRET": JSON.stringify(
            getSstResource("NEXUS_RPC_SECRET")
        ),
        "process.env.VAPID_PUBLIC_KEY": JSON.stringify(
            getSstResource("VAPID_PUBLIC_KEY")
        ),
        "process.env.DEBUG": JSON.stringify(DEBUG),
        // Build-time platform constants consumed by
        // `packages/app-essentials/src/utils/platform.ts`. Substituted to literal
        // booleans so Rolldown's `inlineConst` propagates them to every call site
        // and dead-code-eliminates the unreachable branches (and their `@tauri-apps/*`
        // dynamic imports).
        __IS_TAURI__: JSON.stringify(isTauri),
        __IS_IOS__: JSON.stringify(isTauriIos),
        __IS_ANDROID__: JSON.stringify(isTauriAndroid),
        "process.env.APP_VERSION": JSON.stringify(appVersion),
        "process.env.FRAK_WALLET_URL": JSON.stringify(
            sandboxEnv.walletUrl ??
                getSstResource("FRAK_WALLET_URL") ??
                "https://wallet-dev.frak.id"
        ),
        "process.env.OPEN_PANEL_API_URL": JSON.stringify(
            getSstResource("OPEN_PANEL_API_URL") ?? "https://op-api.gcp.frak.id"
        ),
        "process.env.OPEN_PANEL_WALLET_CLIENT_ID": JSON.stringify(
            getSstResource("OPEN_PANEL_WALLET_CLIENT_ID")
        ),
        "process.env.WEBAUTHN_RP_ID": JSON.stringify(
            process.env.WEBAUTHN_RP_ID
        ),
        "process.env.ANDROID_SHA256_FINGERPRINT": JSON.stringify(
            getSstResource("ANDROID_SHA256_FINGERPRINT")
        ),
        "process.env.MONERIUM_CLIENT_ID": JSON.stringify(
            getSstResource("MONERIUM_CLIENT_ID")
        ),
    };
}

export default defineConfig(
    async ({ mode, command }: ConfigEnv): Promise<UserConfig> => {
        const isSW = mode === "sw";

        const baseConfig: UserConfig = {
            clearScreen: false,
            envPrefix: ["VITE_", "TAURI_"],
            define: await getDefineProps(),
        };

        // Service worker configuration
        if (isSW) {
            return {
                ...baseConfig,
                resolve: {
                    tsconfigPaths: true,
                },
                publicDir: false,
                build: {
                    target: "ES2020",
                    lib: {
                        name: "WalletServiceWorker",
                        entry: "./app/service-worker.ts",
                        formats: ["iife"],
                        fileName: () => "sw.js",
                    },
                    outDir: "public",
                    emptyOutDir: false,
                },
            };
        }

        // Wallet app configuration
        return {
            ...baseConfig,
            css: lightningCssConfig,
            plugins: [
                tanstackRouter({
                    routesDirectory: "./app/routes",
                    generatedRouteTree: "./app/routeTree.gen.ts",
                    // Per-route lazy chunks. The `feature-*` groups in
                    // `buildChunkGroups` re-coalesce these into one chunk
                    // per feature so each navigation is a single fetch.
                    autoCodeSplitting: true,
                    routeFileIgnorePattern: "\\.css\\.ts$",
                    // Per-route splitting policy. We disable splitting for
                    // pure-`<Outlet/>` layouts so they don't each produce a
                    // 200–300 B chunk that is downloaded eagerly with the
                    // child route anyway. Inlining them into the static
                    // route tree adds ~1 KB to the entry chunk in exchange
                    // for ~10 fewer HTTP requests.
                    codeSplittingOptions: {
                        splitBehavior: ({ routeId }) => {
                            // Filename-prefix layouts (TanStack convention).
                            const lastSegment = routeId.split("/").pop() ?? "";
                            if (lastSegment.startsWith("_")) return [];
                            // Parent routes that just render `<Outlet/>` to
                            // host nested children. TanStack's plugin can't
                            // detect this from `routeId` alone; the list is
                            // verified by greppping for `<Outlet />` in the
                            // route files.
                            if (PURE_OUTLET_PARENT_ROUTES.has(routeId)) {
                                return [];
                            }
                            // Default: split the component into a lazy chunk.
                            return undefined;
                        },
                    },
                }),
                viteReact(),
                vanillaExtractPlugin(),
                // Skip HTTPS for Tauri dev (simulators don't trust self-signed certs) and sandbox (proxy handles TLS)
                ...(isTauri || isSandbox ? [] : [mkcert()]),
                ...(isProd ? [removeConsole()] : []),
                stripAbiInternalType(),
                inlineFontFaces({
                    cssFiles: [
                        "public/fonts/inter.css",
                        "public/fonts/inter-tight.css",
                    ],
                    preload: ["/fonts/inter-latin.woff2"],
                }),
            ],
            resolve: {
                tsconfigPaths: true,
                conditions:
                    process.env.NODE_ENV === "production"
                        ? ["production", "default"]
                        : ["development"],
                alias: [
                    ...(command === "build"
                        ? [
                              {
                                  find: "react-dom/server",
                                  replacement: "react-dom/server.node",
                              },
                          ]
                        : []),
                    ...tauriAlias,
                ],
            },
            preview: {
                port: isTauri ? 3010 : 3000,
                allowedHosts: isSandbox ? true : undefined,
                proxy: {
                    // Proxy listener app from separate dev server
                    "/listener": {
                        target: "https://localhost:3002",
                        changeOrigin: true,
                        secure: false, // Allow self-signed certs in dev
                        ws: true, // Proxy websockets if needed
                    },
                    // Monerium sandbox doesn't whitelist localhost origins.
                    "/monerium-api": {
                        target: "https://api.monerium.dev",
                        changeOrigin: true,
                        rewrite: (path) => path.replace(/^\/monerium-api/, ""),
                    },
                },
            },
            server: {
                port: isTauri ? 3010 : 3000,
                // For Tauri dev: tell Vite the host so HMR WebSocket can connect
                host: isTauri ? "0.0.0.0" : "localhost",
                allowedHosts: isSandbox ? true : undefined,
                // Enable HMR for Tauri by explicitly setting the WebSocket URL
                hmr: isTauri
                    ? {
                          protocol: "ws",
                          host: "localhost",
                          port: 3010,
                      }
                    : undefined,
                proxy: {
                    // Proxy listener app from separate dev server
                    "/listener": {
                        target: "https://localhost:3002",
                        changeOrigin: true,
                        secure: false, // Allow self-signed certs in dev
                        ws: true, // Proxy websockets if needed
                    },
                    // Monerium sandbox doesn't whitelist localhost origins.
                    "/monerium-api": {
                        target: "https://api.monerium.dev",
                        changeOrigin: true,
                        rewrite: (path) => path.replace(/^\/monerium-api/, ""),
                    },
                },
                watch: {
                    // Tell vite to ignore watching `src-tauri`
                    ignored: ["**/src-tauri/**"],
                },
            },
            build: {
                // Single bundled stylesheet for both web and Tauri.
                // Per-route CSS splitting was tried, but Vanilla Extract emits
                // a CSS file per `.css.ts` source — that exploded into 38 CSS
                // chunks (25 under 1 KB) for negligible first-paint gain
                // (~5 KB gz). One stylesheet is simpler, fewer requests, and
                // matches Tauri's preferred pattern (single Rust IPC fetch).
                cssCodeSplit: false,
                target: "baseline-widely-available",
                chunkSizeWarningLimit,
                minify: true,
                sourcemap: !isProd,
                rolldownOptions: {
                    experimental: {
                        // Drop debug info in prod (smaller maps), keep in dev.
                        attachDebugInfo,
                        // Lazy-evaluate barrel re-exports — improves tree-shaking
                        // through `wallet-shared` / `app-essentials` / `design-system`
                        // public APIs (proven on the listener build).
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
                            // Default of 1 lets every shared dynamic-import
                            // target spawn its own chunk; bumping to 4 forces
                            // the auto-chunker to inline small shared modules
                            // into their importers (the manual `common` group
                            // catches the rest).
                            minShareCount: 4,
                            // Manual groups whose accumulated size is below 4 KB
                            // are dropped — their modules fall back to auto.
                            minSize: 4096,
                            groups: buildChunkGroups(),
                        },
                    },
                    onwarn,
                },
            },
            optimizeDeps: {
                exclude: ["react-scan"],
            },
        };
    }
);
