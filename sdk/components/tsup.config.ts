import { polyfillNode } from "esbuild-plugin-polyfill-node";
import svgrPlugin from "esbuild-plugin-svgr";
import { defineConfig } from "tsup";

export default defineConfig([
    {
        target: ["chrome67", "edge79", "firefox68", "opera54", "safari14"],
        // All of our entry-points
        entry: ["src/components.ts"],
        esbuildPlugins: [svgrPlugin(), polyfillNode()],
        outDir: "cdn",
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
