import { defineConfig } from "tsup";

export default defineConfig({
    target: "es2022",
    // All of our entry-points
    entry: ["src/bundle.ts"],
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
});
