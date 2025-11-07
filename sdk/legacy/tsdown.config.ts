import { defineConfig } from "tsdown";

/**
 * Legacy UMD Bundle Build Configuration (tsdown)
 *
 * This package provides backward compatibility for legacy integrations using the
 * old "NexusSDK" global name and IIFE format.
 *
 * Configuration:
 * - IIFE format with "NexusSDK" global name
 * - Bundles all dependencies (noExternal)
 * - No TypeScript declarations needed (legacy consumers don't use them)
 *
 * This package exists solely for backward compatibility and is marked as deprecated.
 * New integrations should use @frak-labs/core-sdk instead.
 */
export default defineConfig({
    entry: {
        bundle: "./src/bundle.ts",
    },
    format: "iife",
    globalName: "NexusSDK",
    platform: "browser",
    target: "es2022",
    clean: true,
    minify: true,
    dts: false,
    outDir: "./dist/bundle",
    noExternal: [/.*/],
    treeshake: {
        moduleSideEffects: false,
    },
});
