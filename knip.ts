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
        "example/showcase": {
            entry: ["src/routes/**/*.tsx"],
            project: ["src/**/*.{ts,tsx}"],
        },
        "example/vanilla-js": {
            entry: ["app/*.{ts,tsx}"],
            project: ["app/**/*.{ts,tsx}"],
        },
        "packages/ui": {
            entry: "**/*.{ts,tsx}",
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
    // Ignore legacy SDK from knip
    ignoreWorkspaces: ["sdk/legacy"],
};

export default config;
