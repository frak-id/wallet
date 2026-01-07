import { resolve } from "node:path";
import { isRunningLocally } from "@frak-labs/app-essentials/utils/env";
import { defineConfig } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";

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
        ? `${bundleDir}/loader.js`
        : "https://cdn.jsdelivr.net/npm/@frak-labs/components";

    return {
        server: {
            port: 3013,
        },
        publicDir: "public",
        define: {
            "process.env.USE_CDN": JSON.stringify(mode !== "development"),
        },
        plugins: [
            createHtmlPlugin({
                inject: {
                    data: {
                        injectScript: `<script type="module" src="${scriptSrc}"></script>`,
                        injectReactScan: DEBUG
                            ? `<script src="//unpkg.com/react-scan/dist/auto.global.js"></script>`
                            : "",
                    },
                },
            }),
        ],
    };
});
