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

// Stub rrweb to avoid bundling it — @openpanel/web statically imports `record`
// from rrweb even when session replay is disabled.
// See: https://github.com/Openpanel-dev/openpanel/issues/336
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
    noExternal: [/.*/],
    inlineOnly: false,
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
