import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { isRunningLocally } from "@frak-labs/app-essentials/utils/env";
import { defineConfig } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";
import { detectFrakEnv } from "../shared/detectFrakEnv";

const DEBUG = false;
const projectRootDir = resolve(__dirname);
const bundleDir = resolve(projectRootDir, "../../sdk/components/cdn");

// The deployed demo talks to the dev stage, so it loads the SDK exactly like
// a dev-stage merchant: dev pointer, jsDelivr @beta fallback, both preconnected.
const POINTER_ORIGIN = "https://sdk-dev.frak.id";
const JSDELIVR_ORIGIN = "https://cdn.jsdelivr.net";

export default defineConfig(({ mode }) => {
    // Determine if we should use local resources
    // Use local when: running locally (no SST) OR in development mode
    const useLocal = isRunningLocally || mode === "development";

    // Locally the module loader is used directly; there is no shim to fall back from.
    const scriptSrc = useLocal
        ? `/@fs${bundleDir}/loader.js`
        : `${POINTER_ORIGIN}/components.js`;

    // The page boots the SDK from this bundle alone; a missing one 404s silently.
    if (useLocal && !existsSync(`${bundleDir}/loader.js`)) {
        throw new Error(
            `Missing ${bundleDir}/loader.js — run \`bun run build:sdk\` first.`
        );
    }

    const injectData = {
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
        sdkIsModule: useLocal,
        sdkFallbackSrc: useLocal
            ? ""
            : `${JSDELIVR_ORIGIN}/npm/@frak-labs/components@beta/cdn/components.js`,
        // No `crossorigin` on the pointer (classic no-cors fetch); the shim's
        // `import()` from jsDelivr is CORS-mode, so that one needs it.
        sdkPreconnect: useLocal
            ? ""
            : `<link rel="preconnect" href="${POINTER_ORIGIN}">\n<link rel="preconnect" href="${JSDELIVR_ORIGIN}" crossorigin>`,
        injectReactScan: DEBUG
            ? `<script src="//unpkg.com/react-scan/dist/auto.global.js"></script>`
            : "",
    };

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
            // The plugin derives rollupOptions.input from this list. Declaring
            // input directly instead flips it to MPA mode and drops the ejs
            // data for every page.
            createHtmlPlugin({
                pages: [
                    "index.html",
                    "ambassador-a.html",
                    "ambassador-b.html",
                    "ambassador-c.html",
                    "ambassador-d.html",
                    "ambassador-f.html",
                    "ambassador-h.html",
                    "ambassador-j.html",
                    "ambassador-k.html",
                    "ambassador-k-min.html",
                    "ambassador-l.html",
                ].map((file) => ({
                    filename: file,
                    template: file,
                    injectOptions: { data: injectData },
                })),
            }),
        ],
    };
});
