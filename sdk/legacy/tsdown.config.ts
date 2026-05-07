import { fileURLToPath } from "node:url";
import nodePolyfills from "@rolldown/plugin-node-polyfills";
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

// Stub rrweb to keep this IIFE bundle small. @openpanel/web 1.4.1 dynamically
// imports its replay module (which depends on rrweb), but IIFE bundles inline
// every dependency, so we alias rrweb to a noop. Session replay is disabled in
// our SDK so this has no behavioural impact.
const rrwebStub = fileURLToPath(
    new URL("../core/src/stubs/rrweb.ts", import.meta.url)
);

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
    deps: {
        alwaysBundle: [/.*/],
        onlyBundle: false,
    },
    treeshake: {
        moduleSideEffects: false,
    },
    define: {
        "process.env.CDN_TAG": JSON.stringify(process.env.CDN_TAG || "latest"),
    },
    outputOptions(options) {
        return {
            ...options,
            entryFileNames: "[name].js",
        };
    },
    plugins: [nodePolyfills()],
    alias: { rrweb: rrwebStub },
});
