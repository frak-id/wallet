import { resolve } from "node:path";
import { isRunningLocally } from "@frak-labs/app-essentials/utils/env";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";
import tsconfigPaths from "vite-tsconfig-paths";
import { detectWalletUrl } from "../shared/detectWalletUrl";

const projectRootDir = resolve(__dirname);
const bundleDir = resolve(projectRootDir, "../../sdk/components/cdn");

export default defineConfig(({ mode }) => {
    // Determine if we should use local resources
    // Use local when: running locally (no SST) OR in development mode
    const useLocal = isRunningLocally || mode === "development";

    // In local development, use local bundle
    // Otherwise, use CDN
    const scriptSrc = useLocal
        ? `${bundleDir}/loader.js`
        : "https://cdn.jsdelivr.net/npm/@frak-labs/components";

    return {
        plugins: [
            tanstackRouter({ autoCodeSplitting: true }),
            createHtmlPlugin({
                inject: {
                    data: {
                        useLocal,
                        walletUrl:
                            process.env.FRAK_WALLET_URL ??
                            "https://wallet-dev.frak.id",
                        detectWalletUrl: detectWalletUrl.toString(),
                        sdkScriptSrc: scriptSrc,
                    },
                },
            }),
            viteReact(),
            tsconfigPaths(),
        ],
        css: {
            modules: {
                localsConvention: "camelCase",
            },
            transformer: "lightningcss",
        },
        server: {
            port: 3014,
        },
    };
});
