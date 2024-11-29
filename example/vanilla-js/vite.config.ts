import { resolve } from "node:path";
import { defineConfig } from "vite";

const projectRootDir = resolve(__dirname);
const bundleDir = resolve(projectRootDir, "../../packages/sdk/dist");

export default defineConfig({
    server: {
        port: 3013,
    },
    publicDir: "public",
    plugins: [
        {
            name: "html-transform",
            transformIndexHtml(html) {
                // Replace @/ with the actual path in HTML files
                return html.replace(
                    /<script([^>]*?) src="@\/(.*?)"([^>]*)>/g,
                    (_match, prefix, path, suffix) =>
                        `<script${prefix} src="${bundleDir}/${path}"${suffix}>`
                );
            },
        },
    ],
});
