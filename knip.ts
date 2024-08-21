import type { KnipConfig } from "knip";

const config: KnipConfig = {
    // Exclude types analysis for now
    exclude: ["types"],
    // Include all the workspaces
    workspaces: {
        ".": {
            entry: "sst.config.ts",
            project: "iat/*.ts",
            ignore: [".sst/**"],
        },
        "example/*": {},
        "packages/*": {
            ignore: [".open-next/**", ".next/**"],
        },
        "packages/sdk": {
            entry: "src/**/index.{ts,tsx}",
            project: "src/**/*.{ts,tsx}",
            ignore: ["dist/**"],
        },
        "packages/shared": {
            entry: "**/*.{ts,tsx}",
            project: "**/*.{ts,tsx}",
        },
        "packages/backend": {
            entry: "src/**/*.ts",
            project: "src/**/*.ts",
        },
    },
    // Ignore SDK for knip for now
    ignoreWorkspaces: ["packages/sdk"],
};

export default config;
