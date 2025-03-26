import { tools } from "@frak-labs/shared/tooling/rslib";
import { type LibConfig, defineConfig } from "@rslib/core";

function createLibConfig(config: LibConfig = {}): LibConfig {
    const basicConfig: LibConfig = {
        syntax: "es2022",
        dts: {
            bundle: true,
            autoExtension: true,
        },
        source: {
            entry: {
                index: "./src/index.ts",
                actions: "./src/actions/index.ts",
                interactions: "./src/interactions/index.ts",
            },
        },
    };

    return {
        ...basicConfig,
        ...config,
    };
}

export default defineConfig({
    lib: [
        {
            id: "bundle",
            format: "umd",
            syntax: "es2022",
            umdName: "FrakSDK",
            source: {
                entry: {
                    index: "./src/bundle.ts",
                },
            },
            output: {
                filename: {
                    js: "bundle.js",
                },
                distPath: {
                    root: "./cdn",
                },
            },
        },
        createLibConfig({
            format: "esm",
        }),
        createLibConfig({
            format: "cjs",
        }),
    ],
    mode: "production",
    output: {
        target: "web",
        minify: true,
        cleanDistPath: true,
    },
    tools: {
        ...tools,
    },
});
