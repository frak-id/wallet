import nodePolyfills from "@rolldown/plugin-node-polyfills";
import { defineConfig } from "tsdown";

export default defineConfig({
    entry: {
        index: "./src/index.ts",
        middleware: "./src/middleware/index.ts",
    },
    format: ["esm", "cjs"],
    platform: "browser",
    target: "es2022",
    clean: true,
    minify: true,
    dts: true,
    outDir: "./dist",
    treeshake: {
        moduleSideEffects: false,
    },
    plugins: [nodePolyfills()],
});
