import { defineConfig } from "tsup";

export default defineConfig({
    // All of our entry-points
    entry: ["src/index.ts", "src/core/index.ts", "src/core/actions/index.ts"],
    external: [
        // Mark react as external dependencies
        "react",
        "react-dom",
        // Viem is also a peer dependency
        "viem",
    ],
    // Format waited
    format: ["cjs", "esm"],
    // Code splitting and stuff
    clean: true,
    splitting: true,
    // Types config
    dts: {
        resolve: true,
    },
});
