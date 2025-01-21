import { defineConfig } from "tsup";

export default defineConfig([
    // Config for the npm package
    {
        // All of our entry-points
        entry: [
            "src/index.ts",
            "src/actions/index.ts",
            "src/interactions/index.ts",
        ],
        external: ["viem"],
        noExternal: ["async-lz-string"],
        // Format waited
        format: ["cjs", "esm"],
        // Code splitting and stuff
        clean: true,
        splitting: true,
        treeshake: "smallest",
        // Types config
        dts: {
            resolve: true,
        },
    },
    // Config for the js bundle for vanilla js
    {
        target: "es2022",
        // All of our entry-points
        entry: ["src/bundle.ts"],
        outDir: "cdn",
        outExtension() {
            return {
                js: ".js",
            };
        },
        // No external dependencies for these libraries (will be bundled)
        noExternal: ["async-lz-string", "js-sha256", "viem"],
        // Format waited
        format: ["iife"],
        // Code splitting and stuff
        clean: true,
        splitting: false,
        minify: true,
        // Expose FrakSDK in global namespace window.FrakSDK
        globalName: "FrakSDK",
    },
]);
