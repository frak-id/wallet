import { Buffer } from "node:buffer";
import { injectCssPlugin } from "@bosh-code/tsdown-plugin-inject-css";
import { defineConfig } from "tsdown";
import LightningCSS from "unplugin-lightningcss/rolldown";

/**
 * tsdown configuration for NPM and CDN distribution
 *
 * NPM Build (./dist/):
 * - Separate entry points for each component with CSS modules support
 * - buttonWallet → dist/buttonWallet.js + buttonWallet.css
 * - buttonShare → dist/buttonShare.js + buttonShare.css
 * - injectCssPlugin: Attempts to embed CSS (currently generates separate files)
 *
 * CDN Build (./cdn/):
 * - ESM format with code splitting for optimal loading performance
 * - Multiple entry points (components.ts, loader.ts) share dependencies via chunks
 * - Dynamic chunk naming with hashes for cache-friendly CDN deployment
 * - Preact JSX transformation for web components
 * - CSS: Generated separately with hashes, bundled into loader.css by a custom tsdown plugin
 *
 * Plugins:
 * - unplugin-lightningcss: Handles CSS modules transformation with hashed class names
 *   Uses default pattern to generate: [hash]_[local] (e.g., OW7D8W_button)
 * - injectCssPlugin: Inlines CSS in the NPM build artifacts for easier consumption
 * - combineCssPlugin: Merges hashed CSS assets into a single loader.css during the CDN build
 *
 * CSS Handling:
 * - Lightning CSS generates component-specific CSS files with hashes (ButtonWallet-xyz.css)
 * - Custom combineCssPlugin merges component CSS into loader.css during bundling
 * - loader.ts dynamically loads loader.css before initializing components
 */

/**
 * Custom Rolldown plugin to combine all CSS files into a single loader.css
 * This runs during the generateBundle phase and merges all CSS assets
 */
function combineCssPlugin(fileName = "loader.css") {
    type BundleAsset = {
        type: "asset";
        source: string | Uint8Array;
        [key: string]: unknown;
    };

    type Bundle = Record<
        string,
        BundleAsset | { type?: string; [key: string]: unknown }
    >;

    return {
        name: "frak-combine-css",
        generateBundle(
            this: {
                emitFile: (file: {
                    type: "asset";
                    fileName: string;
                    source: string;
                }) => void;
            },
            _options: unknown,
            bundle: Bundle
        ) {
            const cssChunks: string[] = [];

            for (const [assetName, asset] of Object.entries(bundle)) {
                if (asset.type !== "asset" || !assetName.endsWith(".css")) {
                    continue;
                }

                const sourceValue = (asset as BundleAsset).source;
                const source =
                    typeof sourceValue === "string"
                        ? sourceValue
                        : sourceValue instanceof Uint8Array
                          ? Buffer.from(sourceValue).toString("utf-8")
                          : "";

                cssChunks.push(`/* ${assetName} */\n${source}`);
                delete bundle[assetName];
            }

            if (cssChunks.length === 0) {
                return;
            }

            this.emitFile({
                type: "asset",
                fileName,
                source: cssChunks.join("\n\n"),
            });
        },
    };
}

export default defineConfig([
    {
        entry: {
            buttonShare: "./src/components/ButtonShare/index.ts",
            buttonWallet: "./src/components/ButtonWallet/index.ts",
        },
        format: ["esm"],
        platform: "browser",
        target: "es2022",
        clean: true,
        dts: true,
        outDir: "./dist",
        plugins: [
            LightningCSS({ options: { minify: true } }),
            injectCssPlugin(),
        ],
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
        treeshake: {
            moduleSideEffects: true,
        },
        define: {
            "process.env.BUILD_TIMESTAMP": JSON.stringify(Date.now()),
        },
        outputOptions(options) {
            return {
                ...options,
                entryFileNames: "[name].js",
                chunkFileNames: "[name].[hash].js",
            };
        },
        plugins: [
            LightningCSS({ options: { minify: true } }),
            combineCssPlugin(),
        ],
    },
]);
