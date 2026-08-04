import type { KnipConfig } from "knip";

const config: KnipConfig = {
    // Exclude types analysis for now
    // exclude: ["types"],
    ignore: ["**/*.d.ts"],
    // Include all the workspaces
    workspaces: {
        ".": {
            entry: ["infra/*.ts"],
            project: "infra/**/*.ts",
        },
        "example/vanilla-js": {
            // Plain vite app. index.html boots src/main.ts (registered by the
            // vite plugin, and by knip's default `src/{index,cli,main}` entry),
            // and the only other source is src/types/vite-env.d.ts. There is no
            // app/ directory -- the previous app/ globs matched nothing.
            project: ["src/**/*.ts"],
        },
        "example/wallet-ethcc": {
            // Vite + TanStack Router demo; sources live under app/, the route
            // modules are pulled in through the generated routeTree.
            entry: ["app/routes/**/*.tsx"],
            project: ["app/**/*.{ts,tsx}"],
        },
        "packages/rpc": {
            entry: "**/*.ts",
        },
        "apps/wallet": {
            entry: ["app/*.{ts,tsx}", "app/module/**/*.tsx"],
            project: ["app/**/*.{ts,tsx}"],
        },
        "apps/listener": {
            entry: ["app/*.{ts,tsx}", "app/module/**/*.tsx"],
            project: ["app/**/*.{ts,tsx}"],
        },

        "apps/shopify": {
            entry: ["app/routes/**/*.tsx"],
            project: ["app/**/*.{ts,tsx}", "db/**/*.ts"],
        },
        "apps/business": {
            entry: ["src/router.tsx", "src/routes/**/*.tsx"],
            project: ["src/**/*.{ts,tsx}"],
        },
        "services/backend": {
            entry: ["src/jobs/*.ts"],
            project: "src/**/*.ts",
            // Enable class member detection for backend (DDD with repositories/services)
            includeEntryExports: true,
        },
        "services/bootstrap": {
            // One-shot migration/backfill runner. src/index.ts is the only
            // process entry -- build.ts bundles exactly that, and `bun run
            // src/index.ts` in the start script already registers it -- so the
            // tuning here is the project glob: it adds the root-level build.ts
            // and drizzle-kit configs alongside src/.
            project: ["*.ts", "src/**/*.ts"],
        },
        "services/credential-sync": {
            // Single-shot sync job, bundled from src/index.ts by build.ts.
            entry: ["src/index.ts"],
            project: ["*.ts", "src/**/*.ts"],
        },
        "packages/app-essentials": {
            // Public API is the `exports` map (".", "./blockchain",
            // "./utils/env", "./utils/platform", "./constants/*"); knip derives
            // those entries from the manifest. Deliberately NOT globbing
            // src/**/index.ts here: src/utils/index.ts and src/webauthn/index.ts
            // are internal barrels and must stay export-checked.
            project: ["src/**/*.ts"],
        },
        "packages/client": {
            // The `exports` map (".", "./server", "./server/*") supplies the
            // public entries; the root index.ts barrel backs the bare
            // `@frak-labs/client` deep-import used from tooling.
            entry: ["index.ts"],
            project: ["*.ts", "src/**/*.ts"],
        },
        "packages/dev-tooling": {
            // Consumed as `../../packages/dev-tooling` (root barrel) by the vite
            // configs, and as `@frak-labs/dev-tooling` via the "." export.
            entry: ["index.ts"],
            project: ["*.ts", "src/**/*.ts"],
        },
        "packages/design-system": {
            // Public API is the `exports` map. The subpath TARGETS are the entry
            // points: "./components/charts" -> src/components/charts/index.ts and
            // "./components/*" -> src/components/*/index.tsx are restated below
            // as a single glob; the remaining targets (./icons, ./breakpoints,
            // ./global, ./theme, ./tokens, ./keyframes, ./sprinkles, ./utils,
            // ./hooks/*, ./styles/inAppBanner) are exact files that knip already
            // registers from the manifest. Everything else under src/ -- the
            // chart internals, src/defaults.css.ts, src/reset-globals.css.ts --
            // is private and stays export-checked.
            entry: ["src/components/*/index.{ts,tsx}"],
            project: ["src/**/*.{ts,tsx}"],
        },
        "packages/test-foundation": {
            // Shared vitest harness. Every `exports` target is a flat file under
            // src/ (vitest.shared, *-setup, wallet-mocks, dom-mocks,
            // tanstack-router-mock) referenced from other workspaces' vitest
            // configs, so the manifest already describes the whole surface.
            project: ["src/**/*.ts"],
        },
        "packages/ui-preview": {
            // `exports`: "." -> src/index.ts (from the manifest) and
            // "./components/*" -> src/*/index.tsx, restated below. project also
            // covers src/utils/variables.test.tsx, run by vitest.config.ts.
            entry: ["src/*/index.{ts,tsx}"],
            project: ["src/**/*.{ts,tsx}"],
        },
        "packages/wallet-shared": {
            // 37 export keys: the root "." plus 36 subpaths, FIVE of the
            // subpaths being wildcards. The wildcard targets ("./pairing/*",
            // "./authentication/*", "./wallet/*", "./tokens/*",
            // "./providers/*") make every file under those directories public
            // API -- they are restated as globs here so the whole wildcard-
            // reachable tree is treated as entry rather than dead code. The 32
            // exact targets (src/index.ts, the i18n locales, the stores, the
            // src/common/** hooks and utils, src/types/index.ts, src/test/
            // factories.ts, tests/vitest-fixtures.ts) are registered by knip
            // straight from the manifest.
            entry: [
                "src/pairing/**/*.{ts,tsx}",
                "src/authentication/**/*.{ts,tsx}",
                "src/wallet/**/*.{ts,tsx}",
                "src/tokens/**/*.{ts,tsx}",
                "src/providers/**/*.{ts,tsx}",
            ],
            project: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
        },
        "sdk/core": {
            entry: ["src/**/index.ts"],
            project: "src/**/*.ts",
        },
        "sdk/react": {
            entry: "src/**/index.{ts,tsx}",
            project: "src/**/*.{ts,tsx}",
        },
        "sdk/components": {
            entry: ["src/components.ts", "src/utils/loader.ts"],
            project: "src/**/*.{ts,tsx}",
        },
    },
    ignoreWorkspaces: [
        // Frozen v0 SDK, kept published for consumers still on the old bundle.
        // Not built or released from this repo any more, so its dead code is
        // expected rather than actionable.
        "sdk/legacy",
        // Gradle project: its package.json only dispatches to `scripts/run.sh`,
        // so there is no JS/TS graph for knip to analyse.
        "example/native-android",
        // Xcode project: its package.json only dispatches to `scripts/run.sh`,
        // so there is no JS/TS graph for knip to analyse.
        "example/native-ios",
    ],
};

export default config;
