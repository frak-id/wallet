import { defineConfig } from "tsup";

export default defineConfig([
    // Config for the service worker
    {
        target: "ES2020",
        // All of our entry-points
        entry: {
            sw: "app/service-worker.ts",
        },
        outDir: "public",
        outExtension() {
            return {
                js: ".js",
            };
        },
        // Format waited
        format: ["iife"],
        // Code splitting and stuff
        splitting: false,
        minify: true,
    },
]);
