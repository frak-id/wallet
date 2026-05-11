import fs from "node:fs";
import { fileURLToPath } from "node:url";
import nodePolyfills from "@rolldown/plugin-node-polyfills";
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
    "process.env.BACKEND_URL": JSON.stringify(
        process.env.BACKEND_URL || "https://backend.frak.id"
    ),
    "process.env.OPEN_PANEL_API_URL": JSON.stringify(
        "https://op-api.gcp.frak.id"
    ),
    "process.env.OPEN_PANEL_SDK_CLIENT_ID": JSON.stringify(opClientId),
    "process.env.SDK_VERSION": JSON.stringify(sdkVersion),
    // Default mobile deep-link scheme baked into the published NPM/CDN bundle.
    // In-monorepo dev consumers (listener-dev) override this via their own Vite `define`.
    "process.env.DEEP_LINK_SCHEME": JSON.stringify("frakwallet://"),
};

// Stub rrweb in the CDN/IIFE build only. @openpanel/web 1.4.1 dynamically
// imports its replay module (which depends on rrweb), but the IIFE bundle
// inlines every dependency (alwaysBundle catch-all). Rolldown's DCE doesn't
// drop the unreachable `return await import(...)` even with a build-time
// `__OPENPANEL_REPLAY_URL__` define, so we alias rrweb itself to a noop.
// Session replay is never enabled in the SDK so this is a behavioural no-op.
const rrwebStub = fileURLToPath(
    new URL("./src/stubs/rrweb.ts", import.meta.url)
);

export default defineConfig([
    // NPM distribution (ESM + CJS)
    {
        entry: {
            index: "./src/index.ts",
            actions: "./src/actions/index.ts",
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
        plugins: [nodePolyfills()],
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
        minify:
            process.env.STAGE === "production"
                ? { compress: { dropConsole: true } }
                : true,
        dts: false,
        outDir: "./cdn",
        deps: {
            alwaysBundle: [/.*/],
            onlyBundle: false,
        },
        treeshake: {
            moduleSideEffects: false,
        },
        outputOptions(options) {
            return {
                ...options,
                entryFileNames: "[name].js",
            };
        },
        define: buildDefine,
        plugins: [nodePolyfills()],
        alias: { rrweb: rrwebStub },
    },
]);
