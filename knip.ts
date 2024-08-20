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
        // todo: Fix knip for it, still throwing out a lot of unused types and stuff
        // "packages/sdk": {
        //     entry: "src/**/index.{ts,tsx,js}",
        //     project: "src/**/*.{ts,tsx,js}",
        //     ignore: ["dist/**"],
        // },
        "packages/shared": {
            entry: "context/**/*.{ts,tsx,js},module/**/*.{ts,tsx,js}",
            project: "context/**/*.{ts,tsx,js},module/**/*.{ts,tsx,js}",
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
