import process from "node:process";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";
import removeConsole from "vite-plugin-remove-console";
import {
    assertBundleEsVersion,
    assertEagerBundleBudget,
    blockchainVendorChunkGroup,
    getSandboxEnv,
    getSstResource,
    inlineFontFaces,
    lightningCssConfig,
    onwarn,
    reactVendorChunkGroup,
} from "../../packages/dev-tooling/index.ts";

const isSandbox = !!process.env.ATELIER_SANDBOX_ID;
const isProd = process.env.NODE_ENV === "production";

// Warn-only gzip reference for the eager boot JS closure (login screen).
const EAGER_JS_BUDGET_GZIP = 255 * 1024;

const TANSTACK_VENDOR = /node_modules[\\/]@tanstack/;
const UI_VENDOR =
    /node_modules[\\/](@radix-ui|@floating-ui|lucide-react|react-hook-form)/;

// `tags: ["$initial"]` on `app-shell` limits it to modules statically
// reachable from the entry; without it, bootstrap/lazy-shared modules leak
// into feature chunks and force the entry to static-import them.
function buildChunkGroups() {
    return [
        // Vendor split — stable libraries first for long-term browser cache.
        { ...reactVendorChunkGroup, priority: 40 },
        // Vendor groups are `$initial`-tagged so a library only lazy routes use
        // (react-hook-form, table-core, most of Radix) is not pulled eager just
        // for sharing a vendor name; the `*-lazy` siblings catch the rest.
        {
            name: "tanstack-vendor",
            test: TANSTACK_VENDOR,
            tags: ["$initial"] as "$initial"[],
            priority: 32,
            minShareCount: 1,
        },
        // The `*-lazy` groups must stay below `app-shell`, like
        // blockchain-vendor: above it, a boot module a lazy package imports
        // lands in the lazy chunk and drags that chunk into the eager closure.
        // And above `auth-lazy`/`common-lazy`, or those absorb the vendor code
        // into a chunk whose hash changes with every app release.
        {
            name: "tanstack-vendor-lazy",
            test: TANSTACK_VENDOR,
            priority: 25,
            minShareCount: 1,
        },
        // Must stay *below* `app-shell`: a higher priority buckets the eager
        // `__vitePreload` helper here and drags this ~48 KB chunk into the
        // eager closure.
        { ...blockchainVendorChunkGroup, priority: 25 },
        // `@radix-ui/react-collection` alone, above `ui-vendor` so it claims
        // the package first. Its `OrderedDict extends Map` declares a
        // `toSorted` method es-check reads as `Array.prototype.toSorted`;
        // isolating it keeps the exemption off the rest of `ui-vendor`, where
        // a genuine above-floor call would be masked.
        {
            name: "radix-collection",
            test: /node_modules[\\/]@radix-ui[\\/]react-collection[\\/]/,
            priority: 32,
            minShareCount: 1,
        },
        {
            name: "ui-vendor",
            test: UI_VENDOR,
            tags: ["$initial"] as "$initial"[],
            priority: 30,
            minShareCount: 1,
        },
        {
            name: "ui-vendor-lazy",
            test: UI_VENDOR,
            priority: 25,
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
        // Eager catch-all: everything statically reachable from the entry.
        // No dedicated `design-system` bucket: a group outranking app-shell
        // forces design-system's lazy-only components eager.
        {
            name: "app-shell",
            tags: ["$initial"] as "$initial"[],
            priority: 26,
            minShareCount: 1,
        },
        // Shared LAZY auth code (login methods, verify-email, invite) and what it
        // imports, apart from `common-lazy` so the login screen does not fetch
        // the dashboard's shared viem and countries code with it.
        {
            name: "auth-lazy",
            test: /[\\/]src[\\/]module[\\/]auth[\\/]/,
            priority: 24,
            minShareCount: 2,
            minSize: 0,
        },
        // Shared LAZY app machinery used by 2+ features. Sits above the
        // feature groups so a shared module isn't swept into whichever feature
        // matches its importer first. `forms` must NOT sit in `feature-login`:
        // restricted pages import it. Shared `auth` code is in `auth-lazy`.
        {
            name: "common-lazy",
            test: /[\\/]src[\\/]module[\\/](?:common|forms)[\\/]/,
            priority: 23,
            minShareCount: 2,
            minSize: 0,
        },
        // Per-feature LAZY chunks: route `?tsr-split=` component modules plus
        // their `src/module/<name>/` code. Only `component` bodies are lazy — a
        // route's `beforeLoad`/top-level imports always stay in `$initial`.
        // `feature-login` covers the pre-auth surface (login, invite,
        // verify-email); shared code is in `auth-lazy` and `common-lazy`.
        {
            name: "feature-login",
            test: /[\\/]src[\\/](?:module[\\/]login[\\/]|routes[\\/](?:login|invite|verify-email)(?:\.|[\\/]))/,
            priority: 21,
            minShareCount: 1,
        },
        // Platform-admin tools: merchants never load them.
        {
            name: "feature-internal",
            test: /[\\/]src[\\/](?:module[\\/]internal[\\/]|routes[\\/]_restricted[\\/]internal(?:\.|[\\/]))/,
            priority: 22,
            minShareCount: 1,
        },
        // The image cropper, loaded on the first image drop. Above
        // `feature-restricted`, which would otherwise take the dialog module.
        {
            name: "image-crop-lazy",
            test: /node_modules[\\/](?:react-easy-crop|normalize-wheel)[\\/]|[\\/]src[\\/]module[\\/]merchant[\\/]component[\\/]ImageCropDialog[\\/]/,
            priority: 21,
            minShareCount: 1,
        },
        // Everything behind the `_restricted` auth gate (dashboard, campaigns,
        // members, merchant, settings).
        {
            name: "feature-restricted",
            test: /[\\/]src[\\/](?:module[\\/](?:dashboard|campaigns|members|merchant|settings)[\\/]|routes[\\/]_restricted(?:\.|[\\/]))/,
            priority: 20,
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
            assertEagerBundleBudget({
                budgetGzip: EAGER_JS_BUDGET_GZIP,
                enforce: false,
            }),
            // No `build.target` pin: JS keeps vite's default (safari16.4)
            // while CSS compiles at 15.4 via lightningCssConfig. The 15.4
            // floor comes from wallet traffic this dashboard does not serve,
            // and pinning to it costs ~14 KB gz of class-field lowering.
            assertBundleEsVersion({
                subdir: "assets",
                // @radix-ui/react-collection defines `toSorted` on its own
                // `OrderedDict extends Map`, not `Array.prototype`; es-check
                // matches property names without receiver analysis.
                ignore: {
                    features: "ArrayToSorted",
                    in: "radix-collection",
                },
            }),
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
            "process.env.APP_VERSION": JSON.stringify(
                process.env.COMMIT_HASH ?? ""
            ),
            // Not placing mongo or session encryption key, that's only server side normally
        },
        build: {
            rolldownOptions: {
                experimental: {
                    // Lazy-evaluate barrel re-exports: without this, one named
                    // import from a workspace barrel pulls the barrel's other
                    // re-exports (and their viem imports) into the eager chunk.
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
