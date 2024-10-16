import type { KnipConfig } from "knip";

const config: KnipConfig = {
    // Exclude types analysis for now
    exclude: ["types"],
    ignore: ["**/*.d.ts"],
    // Include all the workspaces
    workspaces: {
        ".": {
            entry: "sst.config.ts",
            project: "iat/*.ts",
            ignore: [".sst/**"],
        },
        "example/*": {},
        "packages/sdk": {
            entry: "src/**/index.{ts,tsx}",
            project: ["src/**/*.{ts,tsx}"],
        },
        "packages/shared": {
            entry: "**/*.{ts,tsx}",
        },
        "packages/wallet": {
            entry: ["src/**/*.tsx", "src/app/service-worker.ts"],
            project: ["src/**/*.{ts,tsx}"],
        },
        "packages/backend-elysia": {
            entry: "src/index.ts",
            project: "src/**/*.ts",
        },
    },
    // Ignore SDK for knip for now
    ignoreWorkspaces: ["packages/sdk"],
};

export default config;
