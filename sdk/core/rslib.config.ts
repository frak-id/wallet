import { tools } from "@frak-labs/shared/tooling/rslib";
import { pluginNodePolyfill } from "@rsbuild/plugin-node-polyfill";
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
    plugins: [pluginNodePolyfill()],
    mode: "production",
    output: {
        target: "web",
        minify: true,
        cleanDistPath: true,
    },
    tools: {
        ...tools,
    },
    source: {
        define: {
            "process.env.OPEN_PANEL_API_URL": JSON.stringify(
                process.env.OPEN_PANEL_API_URL ??
                    "https://op-api.gcp-dev.frak.id"
            ),
            "process.env.OPEN_PANEL_SDK_CLIENT_ID": JSON.stringify(
                process.env.OPEN_PANEL_SDK_CLIENT_ID ??
                    "4c2a39f7-f4c9-406a-a773-a6a298320b12"
            ),
        },
    },
});
