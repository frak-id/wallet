import { resolve } from "node:path";
import { defineConfig } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";

const DEBUG = false;
const USE_CDN = false;
const projectRootDir = resolve(__dirname);
const bundleDir = resolve(projectRootDir, "../../sdk/components/cdn");
const scriptSrc =
    process.env.NODE_ENV === "production"
        ? "https://cdn.jsdelivr.net/npm/@frak-labs/components"
        : `${bundleDir}/components.js`;
const cssSrc =
    process.env.NODE_ENV === "production"
        ? "https://cdn.jsdelivr.net/npm/@frak-labs/components@latest/cdn/components.css"
        : `${bundleDir}/components.css`;

export default defineConfig({
    server: {
        port: 3013,
    },
    publicDir: "public",
    define: {
        "process.env.USE_CDN": JSON.stringify(USE_CDN),
    },
    plugins: [
        createHtmlPlugin({
            inject: {
                data: {
                    injectScript: USE_CDN
                        ? `<script defer src="${scriptSrc}"></script>`
                        : "",
                    injectCSS: USE_CDN
                        ? `<link id="frak-button-wallet" rel="stylesheet" href="${cssSrc}" />`
                        : "",
                    injectReactScan: DEBUG
                        ? `<script src="//unpkg.com/react-scan/dist/auto.global.js"></script>`
                        : "",
                },
            },
        }),
    ],
});
