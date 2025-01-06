import { defineConfig } from "tsup";

export default defineConfig([
    // Config for the js bundle for vanilla js
    {
        target: "es2022",
        // All of our entry-points
        entry: ["src/bundle.ts"],
        outDir: "dist/bundle",
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
        // Expose NexusSDK in global namespace window.NexusSDK
        globalName: "NexusSDK",
    },
]);
