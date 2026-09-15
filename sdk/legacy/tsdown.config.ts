import { defineConfig } from "tsdown";

/**
 * Retired compatibility bundle: inert stubs behind the `NexusSDK` IIFE global,
 * kept only so pages still loading this script do not throw.
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
    outputOptions(options) {
        return {
            ...options,
            entryFileNames: "[name].js",
        };
    },
});
