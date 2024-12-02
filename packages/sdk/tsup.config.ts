import { defineConfig } from "tsup";

export default defineConfig([
    // Config for the npm package
    {
        // All of our entry-points
        entry: [
            "src/core/index.ts",
            "src/core/actions/index.ts",
            "src/core/interactions/index.ts",
            "src/react/index.ts",
        ],
        external: [
            // Mark react as external dependencies
            "react",
            "react-dom",
            // Viem is also a peer dependency
            "viem",
            "@tanstack/react-query",
        ],
        noExternal: ["async-lz-string"],
        // Format waited
        format: ["cjs", "esm"],
        // Code splitting and stuff
        clean: true,
        splitting: true,
        // Types config
        dts: {
            resolve: true,
        },
    },
    // Config for the js bundle for vanilla js
    {
        target: "es2022",
        // All of our entry-points
        entry: ["src/core/bundle.ts"],
        outDir: "dist/bundle",
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
        // Expose NexusSDK in global namespace window.NexusSDK
        globalName: "NexusSDK",
    },
    {
        target: "es2022",
        // All of our entry-points
        entry: ["src/components/bootstrap.ts"],
        outDir: "dist/components",
        outExtension() {
            return {
                js: ".js",
            };
        },
        // Format waited
        format: ["iife"],
        // Code splitting and stuff
        clean: true,
        splitting: false,
        minify: true,
        // Expose FrakComponents in global namespace window.FrakComponents
        globalName: "FrakComponents",
    },
]);
