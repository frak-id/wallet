import { resolve } from "node:path";
import { defineConfig } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";

const projectRootDir = resolve(__dirname);
const bundleDir = resolve(projectRootDir, "../../sdk/components/cdn");
const scriptSrc =
    process.env.NODE_ENV === "production"
        ? "https://cdn.jsdelivr.net/npm/@frak-labs/components@latest/dist/bundle/components.js"
        : `${bundleDir}/components.js`;

export default defineConfig({
    server: {
        port: 3013,
    },
    publicDir: "public",
    plugins: [
        createHtmlPlugin({
            inject: {
                data: {
                    injectScript: `<script src="${scriptSrc}"></script>`,
                },
            },
        }),
    ],
});
