import process from "node:process";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";
import removeConsole from "vite-plugin-remove-console";
import {
    assertEagerBundleBudget,
    getSandboxEnv,
    getSstResource,
    inlineFontFaces,
    lightningCssConfig,
    onwarn,
} from "../../packages/dev-tooling";

const isSandbox = !!process.env.ATELIER_SANDBOX_ID;
const isProd = process.env.NODE_ENV === "production";

// Hard ceiling on the gzipped eager boot JS (login-screen static-import
// closure, walked by `assertEagerBundleBudget`). Measured ~338 KB after the
// feature grouping below (from ~463 KB); 360 KB leaves headroom and fails the
// build if a lazy chunk leaks back into the eager path.
//
// Far larger than the listener's 32 KB because the ~48 KB `blockchain-vendor`
// chunk is still eager: a manual vendor chunk is all-or-nothing, and viem is
// reached from eager route top-level imports (`autoCodeSplitting` only splits a
// route's `component`, not its `beforeLoad`/other top-level imports). Fully
// evicting it needs route-level import discipline — deferred.
const EAGER_JS_BUDGET_GZIP = 360 * 1024;

// Rolldown code-splitting groups, mirroring `apps/wallet/vite.config.ts`.
// `tags: ["$initial"]` on `app-shell` limits it to modules statically
// reachable from the entry; without it, bootstrap/lazy-shared modules leak
// into feature chunks and force the entry to static-import them.
function buildChunkGroups() {
    return [
        // Vendor split — stable libraries first for long-term browser cache.
        {
            name: "react-vendor",
            // Trailing `[\\/]` boundary is load-bearing: without it, `react`
            // also matches `react-hook-form` / `react-i18next` / `react-day-
            // picker` and sweeps those post-auth libs into the eager chunk.
            test: /node_modules[\\/](react|react-dom|scheduler|react[\\/]jsx-runtime)[\\/]/,
            priority: 40,
            minShareCount: 1,
        },
        {
            name: "tanstack-vendor",
            test: /node_modules[\\/]@tanstack/,
            priority: 32,
            minShareCount: 1,
        },
        {
            // Post-login only; must outrank `app-shell` to stay out of the
            // `$initial` closure.
            name: "blockchain-vendor",
            test: /node_modules[\\/](viem|@noble|@scure)/,
            priority: 35,
            minShareCount: 1,
        },
        {
            name: "ui-vendor",
            test: /node_modules[\\/](@radix-ui|lucide-react|cmdk|react-hook-form)/,
            priority: 30,
            minShareCount: 1,
        },
        {
            name: "utils-vendor",
            test: /node_modules[\\/](date-fns|radash)/,
            priority: 28,
            minShareCount: 1,
        },
        {
            // Full country dataset (~44 KB) from the campaign flow — own
            // immutable chunk for caching, kept out of the churning `common`.
            name: "countries-vendor",
            test: /node_modules[\\/]countries-list/,
            priority: 27,
            minShareCount: 1,
        },
        // No dedicated `design-system` cache bucket (unlike wallet / the
        // pre-`$initial` config): with the app-shell `$initial` tag, a group
        // outranking app-shell forces design-system's lazy-only components
        // eager, and one below it only buckets single-feature usage. Not worth
        // the churn; eager design-system rides in app-shell.
        //
        // Eager catch-all: everything statically reachable from the entry.
        {
            name: "app-shell",
            tags: ["$initial"] as "$initial"[],
            priority: 26,
            minShareCount: 1,
        },
        // Shared LAZY app machinery used by 2+ features (common UI, plus the
        // heavily-shared `forms` and `auth` modules). Sits above the feature
        // groups so a shared module isn't swept into whichever feature matches
        // its importer first (Rolldown pulls a matched module's deps along).
        // `forms`/`auth` must NOT sit in `feature-login` — restricted pages
        // import them, and would then have to fetch the login chunk.
        {
            name: "common-lazy",
            test: /[\\/]src[\\/]module[\\/](?:common|forms|auth)[\\/]/,
            priority: 24,
            minShareCount: 2,
            minSize: 0,
        },
        // Per-feature LAZY chunks: route `?tsr-split=` component modules plus
        // their `src/module/<name>/` code. Only `component` bodies are lazy — a
        // route's `beforeLoad`/top-level imports always stay in `$initial`.
        // `feature-login` covers the pre-auth surface (login, invite,
        // verify-email); shared `forms`/`auth` code lives in `common-lazy`.
        {
            name: "feature-login",
            test: /[\\/]src[\\/](?:module[\\/]login[\\/]|routes[\\/](?:login|invite|verify-email)(?:\.|[\\/]))/,
            priority: 22,
            minShareCount: 1,
        },
        // Everything behind the `_restricted` auth gate (dashboard, campaigns,
        // members, merchant, settings).
        {
            name: "feature-restricted",
            test: /[\\/]src[\\/](?:module[\\/](?:dashboard|campaigns|members|merchant|settings)[\\/]|routes[\\/]_restricted(?:\.|[\\/]))/,
            priority: 21,
            minShareCount: 1,
        },
        {
            name: "common",
            priority: 10,
        },
    ];
}

export default defineConfig(async () => {
    const sandboxEnv = await getSandboxEnv();

    return {
        css: lightningCssConfig,
        plugins: [
            tanstackRouter({
                routesDirectory: "./src/routes",
                generatedRouteTree: "./src/routeTree.gen.ts",
                routeFileIgnorePattern: "test|\\.css\\.ts$",
                autoCodeSplitting: true,
            }),
            viteReact(),
            vanillaExtractPlugin(),
            ...(isProd ? [removeConsole()] : []),
            inlineFontFaces({
                cssFiles: ["public/fonts/inter.css"],
                preload: ["/fonts/inter-latin.woff2"],
            }),
            assertEagerBundleBudget({ budgetGzip: EAGER_JS_BUDGET_GZIP }),
        ],
        resolve: {
            tsconfigPaths: true,
            // Prefer production exports for smaller bundles when building
            conditions:
                process.env.NODE_ENV === "production"
                    ? ["production", "default"]
                    : ["development"],
        },
        // Replace some env variable when it's needed
        define: {
            "process.env.STAGE": JSON.stringify(getSstResource("STAGE")),
            "process.env.FRAK_WALLET_URL": JSON.stringify(
                sandboxEnv.walletUrl ?? getSstResource("FRAK_WALLET_URL")
            ),
            "process.env.BACKEND_URL": JSON.stringify(
                sandboxEnv.backendUrl ?? getSstResource("BACKEND_URL")
            ),
            "process.env.ERPC_URL": JSON.stringify(getSstResource("ERPC_URL")),
            "process.env.OPEN_PANEL_API_URL": JSON.stringify(
                getSstResource("OPEN_PANEL_API_URL")
            ),
            "process.env.OPEN_PANEL_BUSINESS_CLIENT_ID": JSON.stringify(
                getSstResource("OPEN_PANEL_BUSINESS_CLIENT_ID")
            ),
            "process.env.DRPC_API_KEY": JSON.stringify(
                getSstResource("DRPC_API_KEY")
            ),
            "process.env.NEXUS_RPC_SECRET": JSON.stringify(
                getSstResource("NEXUS_RPC_SECRET")
            ),
            "process.env.FUNDING_ON_RAMP_URL": JSON.stringify(
                getSstResource("FUNDING_ON_RAMP_URL")
            ),
            // Not placing mongo or session encryption key, that's only server side normally
        },
        build: {
            rolldownOptions: {
                experimental: {
                    // Lazy-evaluate barrel re-exports — without this, importing a
                    // single named export from a workspace package's top-level
                    // barrel (e.g. `isRunningLocally` from `@frak-labs/app-essentials`)
                    // pulls the barrel's OTHER re-exports (including the `./blockchain`
                    // submodule and its real viem imports) into the same eager chunk.
                    // Proven on the listener build; matches `apps/wallet/vite.config.ts`.
                    lazyBarrel: true,
                },
                output: {
                    codeSplitting: {
                        minShareCount: 2,
                        groups: buildChunkGroups(),
                    },
                },
                onwarn,
            },
        },
        server: {
            port: 3001,
            host: isSandbox ? "0.0.0.0" : "localhost",
            allowedHosts: isSandbox ? true : undefined,
        },
    } satisfies UserConfig;
});
