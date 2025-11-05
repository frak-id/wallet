import fs from "node:fs";
import * as esbuild from "esbuild";

/**
 * CDN Bundle Build Script (esbuild)
 *
 * This package uses a dual-tool build approach:
 * - tsdown: Builds NPM packages (ESM + CJS + TypeScript declarations) → ./dist/
 * - esbuild: Builds CDN bundle (IIFE format) → ./cdn/
 *
 * Why esbuild for CDN?
 * 1. IIFE format with globalName (exposes window.FrakSDK for <script> tags)
 * 2. Separate output directory (./cdn/) to avoid mixing with NPM artifacts
 * 3. Stage-aware environment variable injection (dev vs production OpenPanel config)
 * 4. Single-file bundle optimized for CDN delivery
 *
 * tsdown cannot:
 * - Output different formats to different directories
 * - Provide the same level of control over IIFE bundle generation
 *
 * This dual-tool approach is industry standard (used by Vue, React, Preact, etc.)
 * for libraries that need both NPM and CDN distribution.
 */

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

// Clean cdn directory
if (fs.existsSync("./cdn")) {
    fs.rmSync("./cdn", { recursive: true });
}
fs.mkdirSync("./cdn", { recursive: true });

// Build UMD bundle for CDN
await esbuild.build({
    entryPoints: ["./src/bundle.ts"],
    bundle: true,
    minify: true,
    format: "iife",
    globalName: "FrakSDK",
    target: "es2022",
    platform: "browser",
    outfile: "./cdn/bundle.js",
    define: {
        "process.env.OPEN_PANEL_API_URL": JSON.stringify(
            "https://op-api.gcp.frak.id"
        ),
        "process.env.OPEN_PANEL_SDK_CLIENT_ID": JSON.stringify(opClientId),
        "process.env.SDK_VERSION": JSON.stringify(sdkVersion),
    },
    treeShaking: true,
});

console.log("✓ CDN bundle built successfully");
