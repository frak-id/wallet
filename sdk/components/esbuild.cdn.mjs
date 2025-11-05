import fs from "node:fs";
import * as esbuild from "esbuild";

/**
 * CDN Bundle Build Script (esbuild)
 *
 * This package uses a dual-tool build approach:
 * - tsdown: Builds NPM packages (ESM + TypeScript declarations) → ./dist/
 * - esbuild: Builds CDN bundle (ESM with code splitting) → ./cdn/
 *
 * Why esbuild for CDN? (CRITICAL REQUIREMENTS)
 * 1. Code splitting (splitting: true) - Generates shared chunks for optimal loading
 *    - Reduces initial bundle size by extracting common code
 *    - Multiple entry points share dependencies efficiently
 *    - Essential for web component performance
 * 2. Dynamic chunk naming with hashes - Cache-friendly CDN deployment
 * 3. Preact JSX configuration - Web components use Preact under the hood
 * 4. conditions: ["development"] - Bundles from workspace source files for latest code
 *
 * tsdown CANNOT do code splitting, which is a deal breaker for this use case.
 *
 * This dual-tool approach is industry standard (used by Vue, React, Preact, etc.)
 * for component libraries that need both NPM and CDN distribution.
 */

// Clean cdn directory
if (fs.existsSync("./cdn")) {
    fs.rmSync("./cdn", { recursive: true });
}
fs.mkdirSync("./cdn", { recursive: true });

// Build CDN bundles (components and loader)
const buildTimestamp = Date.now();

await esbuild.build({
    entryPoints: ["./src/components.ts", "./src/utils/loader.ts"],
    bundle: true,
    minify: true,
    format: "esm",
    target: "es2022",
    platform: "browser",
    outdir: "./cdn",
    entryNames: "[name]",
    chunkNames: "[name].[hash]",
    splitting: true,
    define: {
        "process.env.BUILD_TIMESTAMP": JSON.stringify(buildTimestamp),
    },
    treeShaking: true,
    jsx: "automatic",
    jsxImportSource: "preact",
    conditions: ["development"], // Use source files from core-sdk instead of built dist
});

console.log("✓ CDN bundles built successfully");
