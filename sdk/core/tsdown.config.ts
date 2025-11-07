import fs from "node:fs";
import { defineConfig } from "tsdown";

const openPanelClientId = {
    dev: "6eacc8d7-49ac-4936-95e9-81ef29449570",
    production: "f305d11d-b93b-487c-80d4-92deb7903e98",
};

// Get the right client id based on the stage
let opClientId = openPanelClientId.dev;
if (process.env.STAGE === "production") {
    opClientId = openPanelClientId.production;
}

// Get the current version from package.json
const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf8"));
const sdkVersion = packageJson.version;

const buildDefine = {
    "process.env.OPEN_PANEL_API_URL": JSON.stringify(
        "https://op-api.gcp.frak.id"
    ),
    "process.env.OPEN_PANEL_SDK_CLIENT_ID": JSON.stringify(opClientId),
    "process.env.SDK_VERSION": JSON.stringify(sdkVersion),
};

export default defineConfig([
    // NPM distribution (ESM + CJS)
    {
        entry: {
            index: "./src/index.ts",
            actions: "./src/actions/index.ts",
            interactions: "./src/interactions/index.ts",
            bundle: "./src/bundle.ts",
        },
        format: ["esm", "cjs"],
        platform: "browser",
        target: "es2022",
        clean: true,
        minify: true,
        dts: true,
        outDir: "./dist",
        treeshake: {
            moduleSideEffects: false,
        },
        define: buildDefine,
    },
    // CDN distribution (IIFE)
    {
        entry: {
            bundle: "./src/bundle.ts",
        },
        format: "iife",
        globalName: "FrakSDK",
        platform: "browser",
        target: "es2022",
        clean: true,
        minify: true,
        dts: false,
        outDir: "./cdn",
        noExternal: [/.*/],
        treeshake: {
            moduleSideEffects: false,
        },
        define: buildDefine,
    },
]);
