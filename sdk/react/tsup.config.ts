import browserslistToEsbuild from "browserslist-to-esbuild";
import { defineConfig } from "tsup";

export default defineConfig([
    // Config for the npm package
    {
        target: browserslistToEsbuild(),
        // All of our entry-points
        entry: ["src/index.ts"],
        external: ["react", "react-dom", "viem", "@tanstack/react-query"],
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
]);
