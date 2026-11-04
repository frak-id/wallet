import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import {
    assertBundleEsVersion,
    BROWSER_TARGET,
    lightningCssConfig,
    onwarn,
    reactVendorChunkGroup,
} from "../../packages/dev-tooling/index.ts";
import { offlineServiceWorker } from "./vite-plugins/offlineServiceWorker.ts";

export default defineConfig({
    // Relative so the build works from any path: a subfolder, a CDN, a USB stick.
    base: "./",
    server: { port: 3014 },
    preview: { port: 3014 },
    css: lightningCssConfig,
    resolve: { tsconfigPaths: true },
    plugins: [
        react(),
        vanillaExtractPlugin(),
        offlineServiceWorker(),
        assertBundleEsVersion(),
    ],
    build: {
        target: BROWSER_TARGET,
        cssMinify: "lightningcss",
        // Every asset is a file the service worker can precache by name.
        assetsInlineLimit: 0,
        rolldownOptions: {
            onwarn,
            output: {
                codeSplitting: {
                    groups: [
                        { ...reactVendorChunkGroup, priority: 20 },
                        {
                            name: "motion-vendor",
                            test: /node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/,
                            priority: 10,
                        },
                    ],
                },
            },
        },
    },
});
