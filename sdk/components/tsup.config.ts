import svgrPlugin from "esbuild-plugin-svgr";
import { defineConfig } from "tsup";

export default defineConfig([
    {
        target: "es2022",
        // All of our entry-points
        entry: ["src/components.ts"],
        replaceNodeEnv: true,
        esbuildPlugins: [svgrPlugin()],
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
