import fs from "node:fs";
import * as esbuild from "esbuild";

/**
 * Legacy UMD Bundle Build Script (esbuild)
 *
 * This package provides backward compatibility for legacy integrations using the
 * old "NexusSDK" global name and UMD module format.
 *
 * Why esbuild only (no tsdown)?
 * 1. Legacy package only needs a single UMD/IIFE bundle
 * 2. No TypeScript declarations needed (legacy consumers don't use them)
 * 3. IIFE format with globalName (exposes window.NexusSDK for <script> tags)
 * 4. conditions: ["development"] - Bundles from core-sdk source for latest code
 *
 * This package exists solely for backward compatibility and is marked as deprecated.
 * New integrations should use @frak-labs/core-sdk instead.
 */

// Clean dist directory
if (fs.existsSync("./dist")) {
    fs.rmSync("./dist", { recursive: true });
}
fs.mkdirSync("./dist/bundle", { recursive: true });

// Build UMD bundle
await esbuild.build({
    entryPoints: ["./src/bundle.ts"],
    bundle: true,
    minify: true,
    format: "iife",
    globalName: "NexusSDK",
    target: "es2022",
    platform: "browser",
    outfile: "./dist/bundle/bundle.js",
    treeShaking: true,
    conditions: ["development"], // Use source files from core-sdk instead of built dist
});

console.log("✓ Legacy UMD bundle built successfully");
