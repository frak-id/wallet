import fs from "node:fs";
import { tools } from "@frak-labs/dev-tooling";
import { pluginNodePolyfill } from "@rsbuild/plugin-node-polyfill";
import { type LibConfig, defineConfig } from "@rslib/core";

const openPanelClientId = {
    dev: "6eacc8d7-49ac-4936-95e9-81ef29449570",
    production: "f305d11d-b93b-487c-80d4-92deb7903e98",
};

function createLibConfig(config: LibConfig = {}): LibConfig {
    // Build the basic config
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
                bundle: "./src/bundle.ts",
            },
        },
    };

    return {
        ...basicConfig,
        ...config,
    };
}

// Get the right client id based on the stage
let opClientId = openPanelClientId.dev;
if (process.env.STAGE === "production") {
    opClientId = openPanelClientId.production;
}

// Get the current version from package.json
const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf8"));
const sdkVersion = packageJson.version;

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
                "https://op-api.gcp.frak.id"
            ),
            "process.env.OPEN_PANEL_SDK_CLIENT_ID": JSON.stringify(opClientId),
            "process.env.SDK_VERSION": JSON.stringify(sdkVersion),
        },
    },
});
