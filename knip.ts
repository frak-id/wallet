import type { KnipConfig } from "knip";

const config: KnipConfig = {
    // Exclude types analysis for now
    exclude: ["types"],
    ignore: ["**/*.d.ts"],
    // Include all the workspaces
    workspaces: {
        ".": {
            entry: ["sst.config.ts", "infra/*.ts"],
            project: "iat/*.ts",
            ignore: [".sst/**"],
        },
        "example/*": {
            entry: ["app/*.{ts,tsx}", "app/views/**/*.tsx"],
            project: ["app/**/*.{ts,tsx}"],
        },
        "packages/shared": {
            entry: "**/*.{ts,tsx}",
        },
        "packages/wallet": {
            entry: ["app/*.{ts,tsx}", "app/views/**/*.tsx"],
            project: ["app/**/*.{ts,tsx}"],
        },
        "packages/dashboard-admin": {
            entry: ["app/root.tsx", "app.routes.ts", "app/routes/**/*.tsx"],
            project: ["app/**/*.{ts,tsx}"],
        },
        "packages/backend-elysia": {
            entry: "src/index.ts",
            project: "src/**/*.ts",
        },
        "sdk/core": {
            entry: ["src/**/index.ts", "src/bundle.ts"],
            project: "src/**/*.ts",
        },
        "sdk/react": {
            entry: "src/**/index.{ts,tsx}",
            project: "src/**/*.{ts,tsx}",
        },
        "sdk/components": {
            entry: ["src/components.ts", "src/index.ts", "src/utils/loader.ts"],
            project: "src/**/*.{ts,tsx}",
        },
    },
    // Ignore legacy SDK from knip
    ignoreWorkspaces: ["sdk/legacy"],
};

export default config;
