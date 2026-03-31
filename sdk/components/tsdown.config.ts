import nodePolyfills from "@rolldown/plugin-node-polyfills";
import { defineConfig } from "tsdown";

function emptyLoaderCssPlugin() {
    return {
        name: "empty-loader-css",
        generateBundle(this: {
            emitFile: (file: {
                type: "asset";
                fileName: string;
                source: string;
            }) => void;
        }) {
            this.emitFile({
                type: "asset",
                fileName: "loader.css",
                source: "",
            });
        },
    };
}

export default defineConfig([
    {
        entry: {
            buttonShare: "./src/components/ButtonShare/index.ts",
            buttonWallet: "./src/components/ButtonWallet/index.ts",
            openInApp: "./src/components/OpenInAppButton/index.ts",
        },
        format: ["esm"],
        platform: "browser",
        target: "es2022",
        clean: true,
        dts: true,
        outDir: "./dist",
        plugins: [nodePolyfills()],
    },
    {
        entry: {
            components: "./src/components.ts",
            loader: "./src/utils/loader.ts",
        },
        format: "esm",
        platform: "browser",
        target: "es2022",
        clean: true,
        minify: true,
        dts: false,
        outDir: "./cdn",
        noExternal: [/.*/],
        inlineOnly: false,
        treeshake: {
            moduleSideEffects: true,
        },
        define: {
            "process.env.BUILD_TIMESTAMP": JSON.stringify(Date.now()),
            "process.env.CDN_TAG": JSON.stringify(
                process.env.CDN_TAG || "latest"
            ),
        },
        outputOptions(options) {
            return {
                ...options,
                entryFileNames: "[name].js",
                chunkFileNames: "[name].[hash].js",
            };
        },
        plugins: [nodePolyfills(), emptyLoaderCssPlugin()],
    },
]);
