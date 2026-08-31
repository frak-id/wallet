import * as path from "node:path";
import * as process from "node:process";
import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import type { UserConfig } from "vite";
import { defineConfig } from "vite";
import removeConsole from "vite-plugin-remove-console";
import {
    assertBundleEsVersion,
    assertEagerBundleBudget,
    BROWSER_TARGET,
    inlineFontFaces,
    lightningCssConfig,
    onwarn,
    preconnectOrigins,
} from "../../packages/dev-tooling";
import { getDefineProps, readDefine } from "./vite.defines";

/**
 * Standalone build for `/sharing` and `/install`.
 *
 * Both pages are opened as full-page loads by the web SDK, by the iOS and
 * Android SDK web views, and by Shopify's post-purchase card. Neither needs a
 * blockchain client, a smart account, a session beyond a token check, or a
 * router — yet booting them through the SPA shell cost ~1.2 MB of JS, because
 * `index.html` drags in wagmi, viem, permissionless, TanStack Router, the
 * query persister and every route module before it can paint two buttons.
 *
 * So they get their own entrypoints and their own bundle. The page components
 * are NOT forked: `SharingView` and `InstallView` are the same modules the SPA
 * routes render (see `app/routes/{sharing,install}.tsx`), parameterised by a
 * navigation adapter. Only the packaging differs.
 *
 * Runs as a SECOND pass over the same `dist/`, after the SPA build:
 *   `vite build && vite build --config vite.standalone.config.ts`
 * hence `emptyOutDir: false` and the `standalone/` asset prefix — the SPA
 * build owns `dist/assets/`, this one owns `dist/standalone/`, and neither can
 * clobber the other's hashed files.
 *
 * NOT built for Tauri: the native app has the routes in its route tree already
 * and navigates to them client-side, so `tauri.conf.json`'s
 * `beforeBuildCommand` deliberately runs only the SPA build.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isProd = process.env.STAGE?.includes("prod") ?? false;
const isSandbox = !!process.env.ATELIER_SANDBOX_ID;

/**
 * Hard ceiling on the gzipped eager boot JS per entry (the transitive
 * static-import closure from the HTML, walked by `assertEagerBundleBudget`).
 *
 * This is the number the whole exercise exists to protect: the SPA shell these
 * pages used to boot through is ~390 KB gz. Anything that pushes past this
 * limit — a stray `@frak-labs/wallet-shared` barrel import that drags viem in,
 * a design-system component that pulls Radix, a full locale bundle — fails the
 * build instead of quietly regressing an SDK-critical path.
 *
 * Measured at the time of writing: 90 KB gz for `/sharing`, 72 KB for
 * `/install`. Raise it only with a measurement and a reason, never to unblock
 * a build — that turns the ratchet into a moving line.
 */
const EAGER_JS_BUDGET_GZIP = 105 * 1024;

// Build-time stub that swaps every `@tauri-apps/*` and `tauri-plugin-*`
// runtime path with a no-op module: these pages never run inside Tauri (the
// native app uses the SPA routes), so every call site is dead under
// `IS_TAURI = false` and the stub keeps the real runtime out of the graph.
const tauriStub = path.resolve(
    __dirname,
    "../../packages/wallet-shared/src/stubs/tauri-noop.ts"
);

// Preact instead of React, exactly as the listener does it: react-dom alone is
// ~530 KB of source (~59 KB gz), more than half of everything these two pages
// download, and neither uses a React feature preact/compat does not cover.
// The SPA build is untouched — it keeps React.
//
// Absolute paths, not bare specifiers: the wallet installs preact, but the
// workspace packages it consumes through the `development` export condition
// (`wallet-shared`, `design-system`) import from "react" and have no preact in
// their own `node_modules`. Under Bun's per-package layout a bare alias would
// resolve differently per importer and bundle two copies of compat.
const preactRoot = path.resolve(__dirname, "node_modules/preact");
const preactCompat = path.join(preactRoot, "compat");
const preactCompatClient = path.join(preactRoot, "compat/client");
const preactJsxRuntime = path.join(preactRoot, "jsx-runtime");
const preactHooks = path.join(preactRoot, "hooks");

const preactAlias = [
    { find: /^preact$/, replacement: preactRoot },
    { find: /^preact\/compat$/, replacement: preactCompat },
    { find: /^preact\/compat\/client$/, replacement: preactCompatClient },
    { find: /^preact\/jsx-runtime$/, replacement: preactJsxRuntime },
    { find: /^preact\/hooks$/, replacement: preactHooks },
    // React shim: every `import ... from "react"` in app and workspace code
    // keeps working unchanged.
    { find: /^react$/, replacement: preactCompat },
    { find: /^react-dom$/, replacement: preactCompat },
    { find: /^react-dom\/client$/, replacement: preactCompatClient },
    { find: /^react\/jsx-runtime$/, replacement: preactJsxRuntime },
    { find: /^react\/jsx-dev-runtime$/, replacement: preactJsxRuntime },
];

export default defineConfig(async (): Promise<UserConfig> => {
    // Same defines as the SPA build — same backend, same analytics project,
    // same app version. `isTauri` is hard `false` here, which is what lets
    // Rolldown dead-code-eliminate every Tauri branch and its dynamic imports.
    const define = await getDefineProps({
        isTauri: false,
        isTauriIos: false,
        isTauriAndroid: false,
    });
    const backendUrl = readDefine(define, "process.env.BACKEND_URL");

    return {
        clearScreen: false,
        define,
        css: lightningCssConfig,
        // Named JSON exports instead of one stringified blob, so
        // `i18n/locales/*/standalone.ts` can import `{ installCode }` and have
        // Rolldown drop the other ~45 KB of `translation.json`. Vite's default
        // (`stringify: "auto"`) turns any JSON over 10 KB into a single
        // `JSON.parse("…")` call, which is faster to parse but impossible to
        // tree-shake — the wrong trade for a page that reads 10 keys.
        json: { namedExports: true, stringify: false },
        resolve: {
            tsconfigPaths: true,
            // Production conditions matter for tree shaking: "development"
            // resolves full dev builds with their debug code.
            conditions:
                process.env.NODE_ENV === "production"
                    ? ["production", "default"]
                    : ["development"],
            alias: [
                { find: /^@tauri-apps\/.*$/, replacement: tauriStub },
                { find: /^tauri-plugin-.*$/, replacement: tauriStub },
                ...preactAlias,
            ],
        },
        plugins: [
            // `reactAliasEnabled: false` because the aliases above are
            // absolute and must win; the preset's bare-specifier ones would
            // resolve per-importer under Bun's layout.
            preact({ reactAliasesEnabled: false }),
            vanillaExtractPlugin(),
            ...(isProd ? [removeConsole()] : []),
            inlineFontFaces({
                cssFiles: [
                    "public/fonts/inter.css",
                    "public/fonts/inter-tight.css",
                ],
                preload: ["/fonts/inter-latin.woff2"],
            }),
            // Both pages issue their first backend call from a React component,
            // so nothing reaches this origin until the entry chunk has
            // downloaded and parsed. `use-credentials` matches the eventual
            // request: `backendClient` sends `credentials: "include"`.
            preconnectOrigins({
                origins: [{ url: backendUrl, crossorigin: "use-credentials" }],
            }),
            assertEagerBundleBudget({
                budgetGzip: EAGER_JS_BUDGET_GZIP,
                htmlFiles: ["sharing.html", "install.html"],
            }),
            assertBundleEsVersion({
                subdir: "standalone",
                // @radix-ui/react-collection defines `toSorted` as a method on
                // its own `OrderedDict extends Map`, not `Array.prototype`.
                // es-check matches property names without receiver analysis.
                ignore: {
                    features: "ArrayToSorted",
                    in: "standalone-radix-collection",
                },
            }),
        ],
        build: {
            outDir: "dist",
            // The SPA build ran first and owns `dist/`. Wiping it here would
            // delete the app.
            emptyOutDir: false,
            // Per-entry stylesheets. The SPA sets this to `false` because
            // Vanilla Extract emits one CSS file per `.css.ts` and the app has
            // ~38 of them; these two pages touch a handful, and shipping the
            // SPA's 89 KB stylesheet to render a share sheet is exactly the
            // waste this build exists to remove.
            cssCodeSplit: true,
            target: BROWSER_TARGET,
            minify: true,
            sourcemap: !isProd,
            chunkSizeWarningLimit: 150,
            rolldownOptions: {
                input: {
                    sharing: path.resolve(__dirname, "sharing.html"),
                    install: path.resolve(__dirname, "install.html"),
                },
                experimental: {
                    attachDebugInfo: isProd ? "none" : "full",
                    // Lazy-evaluate barrel re-exports so tree-shaking reaches
                    // through `wallet-shared` / `design-system` public APIs.
                    lazyBarrel: true,
                },
                treeshake: {
                    moduleSideEffects: "no-external",
                    propertyReadSideEffects: false,
                },
                optimization: {
                    // Propagates the `__IS_TAURI__` / stage literals to every
                    // call site so the dead branches disappear.
                    inlineConst: { mode: "all", pass: 3 },
                },
                output: {
                    // Own namespace under `dist/`, so this pass and the SPA
                    // pass can never collide on a hashed filename.
                    entryFileNames: "standalone/[name]-[hash].js",
                    chunkFileNames: "standalone/[name]-[hash].js",
                    assetFileNames: "standalone/[name]-[hash][extname]",
                    codeSplitting: {
                        // The two entries share almost everything (React,
                        // query, i18n, design system). One shared chunk plus a
                        // small per-page chunk beats a scatter of 1 KB files.
                        minShareCount: 2,
                        minSize: 4096,
                        groups: [
                            // MUST outrank `standalone-vendor`: OpenPanel
                            // reaches its rrweb session-replay recorder
                            // (~525 KB of source) through a runtime-gated
                            // `await import()`, which no bundler can
                            // dead-code-eliminate. Without this group the
                            // catch-all below swallows it into the eager
                            // vendor chunk and every share sheet downloads a
                            // recorder the wallet never enables.
                            {
                                name: "openpanel-replay",
                                test: /[\\/]node_modules[\\/](?:rrweb|rrdom|rrweb-snapshot|@rrweb|@openpanel[\\/]web[\\/]dist[\\/]replay-)/,
                                priority: 20,
                                minShareCount: 1,
                            },
                            // `minShareCount: 2` on purpose: only vendor code
                            // BOTH pages need is hoisted. Vendor code one page
                            // needs (sonner's toaster and the Radix accordion
                            // behind the sharing FAQ) falls through to the
                            // auto-chunker and lands in that page's chunk, so
                            // `/install` does not download a toast library it
                            // never renders.
                            // The lazily-fetched English locale subset.
                            // Grouped only for its name: the auto-chunker
                            // calls it `standalone-*` after the source file,
                            // which reads like the boot chunk.
                            {
                                name: "i18n-en",
                                test: /[\\/]i18n[\\/]locales[\\/]en[\\/]/,
                                priority: 15,
                                minShareCount: 1,
                            },
                            // `@radix-ui/react-collection` only, split out
                            // even though one page uses it. Left inline its
                            // `OrderedDict.toSorted` lands in the 88 KB
                            // first-party entry chunk, and the exemption that
                            // requires would blanket every line of
                            // first-party sharing code — on one of the two
                            // pages this floor exists to protect. Narrow to
                            // the one package so `/install` does not download
                            // the rest of Radix to buy that isolation.
                            {
                                name: "standalone-radix-collection",
                                test: /[\\/]node_modules[\\/]@radix-ui[\\/]react-collection[\\/]/,
                                priority: 12,
                                minShareCount: 1,
                            },
                            {
                                name: "standalone-vendor",
                                test: /[\\/]node_modules[\\/]/,
                                priority: 10,
                                minShareCount: 2,
                            },
                            // First-party code both pages need: the shared
                            // boot, the design-system pieces, the reward
                            // formatting. Ranked BELOW `standalone-vendor`
                            // because Rolldown pulls a matched module's whole
                            // transitive closure into its group — the vendor
                            // group has to claim `node_modules` first or this
                            // one would swallow it.
                            //
                            // Named explicitly so the budget breakdown stays
                            // readable: left to the auto-chunker this chunk
                            // takes the name of whichever module happened to
                            // sort first (`sanitizeReturnScheme-*.js`), which
                            // tells a future reader nothing.
                            {
                                name: "standalone-shared",
                                test: /[\\/](?:app|packages|sdk)[\\/]/,
                                priority: 5,
                                minShareCount: 2,
                            },
                        ],
                    },
                },
                onwarn,
            },
        },
        server: {
            port: 3020,
            allowedHosts: isSandbox ? true : undefined,
        },
        preview: {
            port: 3020,
            allowedHosts: isSandbox ? true : undefined,
        },
    };
});
