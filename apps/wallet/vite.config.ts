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
    assertBundleEsVersion,
    BROWSER_TARGET,
    inlineFontFaces,
    lightningCssConfig,
    onwarn,
    preconnectOrigins,
    stripAbiInternalType,
} from "../../packages/dev-tooling";
import { routerGenerationOptions } from "./router.options";
import { getDefineProps, readDefine } from "./vite.defines";

const isProd = process.env.STAGE?.includes("prod") ?? false;
const isTauri = !!process.env.TAURI_CLI_RUNNING;
// Tauri 2 sets `TAURI_ENV_PLATFORM` for hook commands (`ios`, `android`, `darwin`, `linux`, `windows`).
// Combined with `TAURI_CLI_RUNNING`, lets us hard-code platform booleans per Tauri target build,
// so the iOS bundle drops Android-only code and vice-versa.
const tauriPlatform = process.env.TAURI_ENV_PLATFORM;
const isTauriIos = isTauri && tauriPlatform === "ios";
const isTauriAndroid = isTauri && tauriPlatform === "android";
const isSandbox = !!process.env.ATELIER_SANDBOX_ID;
// `vite build --watch` (used by `dev:built`) re-empties `outDir` on EVERY
// rebuild, not just the first. `dist/` is shared with the standalone pass
// (`vite.standalone.config.ts` writes `sharing.html`, `install.html` and
// `standalone/` there), so emptying on rebuild would delete the other build's
// output every time a source file changed. `dev:built` cleans `dist/` itself
// once at startup instead. Read from argv because Vite resolves `--watch`
// into `build.watch` only after this config function has run.
const isWatch = process.argv.includes("--watch") || process.argv.includes("-w");
// Web stays strict at 300 KB to surface regressions early; Tauri allows
// 500 KB since assets ship in the binary (no network cost) and the
// `blockchain-vendor` chunk runs close to the limit.
const chunkSizeWarningLimit = isTauri ? 500 : 300;
// Drop Rolldown debug info in prod (smaller maps), keep full in dev.
const attachDebugInfo: "full" | "none" = isProd ? "none" : "full";

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

// `/sharing` and `/install` are served from their own build on the web
// (`vite.standalone.config.ts` + nginx exact-match locations), so the SPA
// copies of those two pages are Tauri-only. Swapping the views for redirect
// stubs on the web build keeps them — and `sonner`, `CodeInput` and the
// pending-action tree behind them — out of `feature-social`, which every
// `_protected-fullscreen` route also pulls. See `StandaloneRedirect.tsx`.
//
// Only the views are aliased, not the route files: the routes stay in
// `routeTree.gen.ts` for both targets, so the generated tree never depends on
// the build and `to: "/install"` keeps typechecking.
const standaloneRedirectStub = path.resolve(
    __dirname,
    "./app/module/common/component/StandaloneRedirect.tsx"
);

const standalonePageAlias = isTauri
    ? []
    : [
          {
              find: /^@\/module\/sharing\/component\/SharingView$/,
              replacement: standaloneRedirectStub,
          },
          {
              find: /^@\/module\/install\/component\/InstallView$/,
              replacement: standaloneRedirectStub,
          },
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
        // `@radix-ui/react-collection` alone, above `ui-vendor` so it claims
        // the package first. Its `OrderedDict extends Map` declares a
        // `toSorted` method that es-check reads as `Array.prototype.toSorted`;
        // isolating it keeps the exemption off the rest of Radix, vaul,
        // sonner, lucide-react and micromark, where a genuine above-floor
        // call would otherwise be masked.
        {
            name: "radix-collection",
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]react-collection[\\/]/,
            priority: 32,
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
        // Sharing + install: the `?tsr-split=` route components, plus the
        // `SharingView` / `InstallView` modules they render. Those views are
        // shared with the standalone web build (`vite.standalone.config.ts`),
        // so they live under `app/module/` rather than in the route files —
        // named here so they stay in this lazy chunk instead of scattering.
        {
            name: "feature-social",
            test: /[\\/]app[\\/](?:module[\\/](?:sharing|install)[\\/]|routes[\\/](?:_wallet[\\/]_protected-fullscreen[\\/]|(?:sharing|install)\.).*\?tsr-split=)/,
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

export default defineConfig(
    async ({ mode, command }: ConfigEnv): Promise<UserConfig> => {
        const isSW = mode === "sw";

        const define = await getDefineProps({
            isTauri,
            isTauriIos,
            isTauriAndroid,
        });
        const baseConfig: UserConfig = {
            clearScreen: false,
            envPrefix: ["VITE_", "TAURI_"],
            define,
            // Named JSON exports rather than one stringified blob. Must match
            // `vite.standalone.config.ts`: `vite dev` serves BOTH the SPA and
            // the standalone entrypoints from this config, and
            // `i18n/locales/*/standalone.ts` imports single keys out of
            // `translation.json` by name — which a `JSON.parse("…")` module
            // cannot provide.
            json: { namedExports: true, stringify: false },
        };

        // Read back from the defines rather than resolving these a second
        // time, so a preconnect can never point somewhere the app does not.
        const backendUrl = readDefine(define, "process.env.BACKEND_URL");
        const erpcUrl = readDefine(define, "process.env.ERPC_URL");
        const nexusRpcSecret = readDefine(
            define,
            "process.env.NEXUS_RPC_SECRET"
        );

        // Service worker configuration
        if (isSW) {
            return {
                ...baseConfig,
                resolve: {
                    tsconfigPaths: true,
                },
                publicDir: false,
                build: {
                    // Deliberately below BROWSER_TARGET: an IIFE lib build
                    // emitted to public/, outside typecheck and outside the
                    // standalone pass the ES-version gate inspects.
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
                tanstackRouter(routerGenerationOptions),
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
                // The first backend call is issued from a React component, so
                // nothing reaches this origin until the entry chunk and every
                // vendor chunk above have downloaded and parsed. Opening the
                // connection from `<head>` moves the DNS, TCP and TLS cost
                // into that window. `use-credentials` matches the eventual
                // request: the backend is cross-origin and `backendClient`
                // sends `credentials: "include"`.
                preconnectOrigins({
                    origins: [
                        {
                            url: backendUrl,
                            crossorigin: "use-credentials",
                        },
                        // The smart-account provider is built during boot
                        // and its first RPC call goes out on the same early
                        // path. viem's `http` transport leaves `credentials`
                        // at the default, so this one is anonymous.
                        //
                        // Gated on the secret because `getErpcTransport`
                        // returns undefined without it and the provider falls
                        // back to dRPC, leaving this origin uncalled. An
                        // unused hint holds a socket open and earns a console
                        // warning.
                        {
                            url: nexusRpcSecret ? erpcUrl : undefined,
                            crossorigin: "anonymous",
                        },
                    ],
                }),
                assertBundleEsVersion({
                    subdir: "assets",
                    // @radix-ui/react-collection defines `toSorted` on its own
                    // `OrderedDict extends Map`, not `Array.prototype`;
                    // es-check matches property names without receiver
                    // analysis.
                    ignore: {
                        features: "ArrayToSorted",
                        in: "radix-collection",
                    },
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
                    ...standalonePageAlias,
                ],
            },
            preview: {
                port: isTauri ? 3010 : 3000,
                // Tauri dev bakes the platform flag at server-start and the
                // WebView loads whatever owns :3010 (devUrl + adb reverse). Fail
                // loud on a port collision instead of silently moving to :3011
                // while a stale/wrong-platform squatter keeps :3010.
                strictPort: isTauri,
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
                // Fail loud on a :3010 collision rather than silently falling
                // back to another port while a stale/wrong-platform dev server
                // squats :3010 and gets loaded by the Tauri WebView.
                strictPort: isTauri,
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
                // See `isWatch`: under `--watch` this build shares `dist/` with the
                // standalone pass and must not wipe it on every rebuild.
                emptyOutDir: !isWatch,
                // Single bundled stylesheet for both web and Tauri.
                // Per-route CSS splitting was tried, but Vanilla Extract emits
                // a CSS file per `.css.ts` source — that exploded into 38 CSS
                // chunks (25 under 1 KB) for negligible first-paint gain
                // (~5 KB gz). One stylesheet is simpler, fewer requests, and
                // matches Tauri's preferred pattern (single Rust IPC fetch).
                cssCodeSplit: false,
                target: BROWSER_TARGET,
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
