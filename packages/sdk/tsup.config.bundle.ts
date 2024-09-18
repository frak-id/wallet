import { defineConfig } from "tsup";

export default defineConfig({
    // All of our entry-points
    entry: ["src/bundle.ts"],
    outDir: "dist/bundle",
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
