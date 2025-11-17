import { resolve } from "node:path";
import { isRunningLocally } from "@frak-labs/app-essentials/utils/env";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";
import tsconfigPaths from "vite-tsconfig-paths";

const projectRootDir = resolve(__dirname);
const bundleDir = resolve(projectRootDir, "../../sdk/components/cdn");

export default defineConfig(({ mode }) => {
    // Determine if we should use local resources
    // Use local when: running locally (no SST) OR in development mode
    const useLocal = isRunningLocally || mode === "development";

    // Determine wallet URL based on environment
    // In local development, use localhost
    // Otherwise, use the dev URL
    const walletUrl = useLocal
        ? "https://localhost:3000"
        : "https://wallet-dev.frak.id";

    // In local development, use local bundle
    // Otherwise, use CDN
    const scriptSrc = useLocal
        ? `${bundleDir}/components.js`
        : "https://cdn.jsdelivr.net/npm/@frak-labs/components";

    return {
        plugins: [
            tanstackRouter({ autoCodeSplitting: true }),
            createHtmlPlugin({
                inject: {
                    data: {
                        walletUrl,
                        injectScript: `<script type="text/javascript" src="${scriptSrc}" defer></script>`,
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
