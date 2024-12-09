import type { KnipConfig } from "knip";

const config: KnipConfig = {
    // Exclude types analysis for now
    exclude: ["types"],
    ignore: ["**/*.d.ts", "packages/shopify-app/**"],
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
        "packages/sdk": {
            entry: "src/**/index.{ts,tsx}",
            project: ["src/**/*.{ts,tsx}"],
        },
        "packages/shared": {
            entry: "**/*.{ts,tsx}",
        },
        "packages/wallet": {
            entry: ["app/*.{ts,tsx}", "app/views/**/*.tsx"],
            project: ["app/**/*.{ts,tsx}"],
        },
        "packages/backend-elysia": {
            entry: "src/index.ts",
            project: "src/**/*.ts",
        },
        "packages/shopify-app": {
            entry: ["app/**/*.tsx"],
            project: ["app/**/*.{ts,tsx}"],
        },
    },
    // Ignore SDK for knip for now
    ignoreWorkspaces: ["packages/sdk"],
};

export default config;
