import { injectCssPlugin } from "@bosh-code/tsdown-plugin-inject-css";
import { defineConfig } from "tsdown";
import LightningCSS from "unplugin-lightningcss/rolldown";

/**
 * tsdown configuration for NPM distribution
 *
 * This builds separate entry points for each component with CSS modules support:
 * - buttonWallet → dist/buttonWallet.js (CSS embedded via injectCssPlugin)
 * - buttonShare → dist/buttonShare.js (CSS embedded via injectCssPlugin)
 *
 * Plugins:
 * - unplugin-lightningcss: Handles CSS modules transformation with hashed class names
 *   Uses default pattern to generate: [hash]_[local] (e.g., OW7D8W_button)
 * - injectCssPlugin: Embeds CSS into JS bundles, eliminating need for separate CSS imports
 *
 * Note: Separate .css files are also generated for manual import if needed
 */
export default defineConfig({
    entry: {
        buttonShare: "./src/components/ButtonShare/index.ts",
        buttonWallet: "./src/components/ButtonWallet/index.ts",
    },
    format: ["esm"],
    platform: "browser",
    target: "es2022",
    clean: true,
    dts: true,
    plugins: [LightningCSS({ options: { minify: true } }), injectCssPlugin()],
});
