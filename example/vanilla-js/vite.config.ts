import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { isRunningLocally } from "@frak-labs/app-essentials/utils/env";
import { defineConfig } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";
import { detectFrakEnv } from "../shared/detectFrakEnv";

const DEBUG = false;
const projectRootDir = resolve(__dirname);
const bundleDir = resolve(projectRootDir, "../../sdk/components/cdn");

export default defineConfig(({ mode }) => {
    // Determine if we should use local resources
    // Use local when: running locally (no SST) OR in development mode
    const useLocal = isRunningLocally || mode === "development";

    // In local development, use local loader directly
    // Otherwise, use CDN components.js (which loads from CDN)
    const scriptSrc = useLocal
        ? `/@fs${bundleDir}/loader.js`
        : "https://cdn.jsdelivr.net/npm/@frak-labs/components@beta/cdn/loader.js";

    // The page boots the SDK from this bundle alone; a missing one 404s silently.
    if (useLocal && !existsSync(`${bundleDir}/loader.js`)) {
        throw new Error(
            `Missing ${bundleDir}/loader.js — run \`bun run build:sdk\` first.`
        );
    }

    return {
        server: {
            port: 3013,
        },
        publicDir: "public",
        // Consuming the SDK from source leaves its `process.env` reads unsubstituted.
        define: {
            "process.env": JSON.stringify({
                DEEP_LINK_SCHEME: "frakwallet://",
                SDK_VERSION: "dev",
            }),
        },
        plugins: [
            createHtmlPlugin({
                inject: {
                    data: {
                        useLocal,
                        remoteEnv: JSON.stringify(
                            process.env.FRAK_WALLET_URL
                                ? {
                                      wallet: process.env.FRAK_WALLET_URL,
                                      backend:
                                          process.env.BACKEND_URL ??
                                          "https://backend.gcp-dev.frak.id",
                                  }
                                : "dev"
                        ),
                        detectFrakEnv: detectFrakEnv.toString(),
                        sdkScriptSrc: scriptSrc,
                        injectReactScan: DEBUG
                            ? `<script src="//unpkg.com/react-scan/dist/auto.global.js"></script>`
                            : "",
                    },
                },
            }),
        ],
    };
});
