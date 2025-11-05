import { defineConfig } from "tsdown";

export default defineConfig({
    entry: {
        buttonShare: "./src/components/ButtonShare/index.ts",
        buttonWallet: "./src/components/ButtonWallet/index.ts",
    },
    format: ["esm"],
    platform: "browser",
    target: "es2022",
    clean: true,
    minify: true,
    dts: true,
    outDir: "./dist",
    treeshake: {
        moduleSideEffects: false,
    },
});
