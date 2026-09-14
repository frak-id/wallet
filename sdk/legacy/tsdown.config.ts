import { fileURLToPath } from "node:url";
import nodePolyfills from "@rolldown/plugin-node-polyfills";
import { defineConfig } from "tsdown";

/**
 * Deprecated compatibility bundle: the `NexusSDK` IIFE global.
 * New integrations use `@frak-labs/core-sdk`.
 */

// Aliased in this inlined IIFE bundle — see `../core/src/stubs/rrweb.ts`.
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
