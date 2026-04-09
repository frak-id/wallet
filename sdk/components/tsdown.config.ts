import nodePolyfills from "@rolldown/plugin-node-polyfills";
import {
    compile,
    cssFileFilter,
    getSourceFromVirtualCssFile,
    processVanillaFile,
    virtualCssFileFilter,
} from "@vanilla-extract/integration";
import type { Plugin } from "rolldown";
import { defineConfig } from "tsdown";

/**
 * Vanilla Extract inline plugin for Web Components.
 *
 * Compiles .css.ts files and resolves .vanilla.css virtual imports
 * as JS modules exporting the CSS as a `cssSource` string.
 * Components inject this string at runtime via styleManager.
 */
function vanillaExtractInlinePlugin(): Plugin {
    const cwd = process.cwd();
    const isProduction = process.env.NODE_ENV === "production";
    const identOption = isProduction ? "short" : "debug";
    const cssMap = new Map<string, string>();

    return {
        name: "vanilla-extract-inline",

        buildStart() {
            cssMap.clear();
        },

        async transform(_code, id) {
            if (!cssFileFilter.test(id)) {
                return null;
            }

            const [filePath] = id.split("?");
            const { source, watchFiles } = await compile({
                filePath,
                cwd,
                identOption,
            });

            for (const file of watchFiles) {
                this.addWatchFile(file);
            }

            const output = await processVanillaFile({
                source,
                filePath,
                identOption,
            });

            // Rewrite ALL side-effect .vanilla.css imports into named imports
            // VE generates: import 'file.vanilla.css?source=...'
            // We rewrite to: import { cssSource as css_N } from 'file.vanilla.css?source=...'
            let counter = 0;
            const cssImportNames: string[] = [];
            const rewritten = output
                .replace(/export (?:const|var|let) cssSource[^;]*;/g, "")
                .replace(
                    /import ['"]([^'"]+\.vanilla\.css[^'"]*)['"];?/g,
                    (_match, specifier) => {
                        const name = `__veCss${counter++}`;
                        cssImportNames.push(name);
                        return `import { cssSource as ${name} } from "${specifier}";`;
                    }
                );

            // Concatenate all CSS chunks and export as cssSource
            const cssExport =
                cssImportNames.length > 0
                    ? `\nexport const cssSource = ${cssImportNames.join(" + ")};`
                    : "";

            return {
                code: rewritten + cssExport,
                map: { mappings: "" },
            };
        },

        async resolveId(id) {
            if (!virtualCssFileFilter.test(id)) {
                return null;
            }

            const { fileName, source } = await getSourceFromVirtualCssFile(id);

            const virtualId = `\0ve-inline:${fileName.replace(/\.css$/, ".js")}`;
            cssMap.set(virtualId, source);
            return virtualId;
        },

        load(id) {
            if (!id.startsWith("\0ve-inline:")) {
                return null;
            }

            const css = cssMap.get(id);
            if (css === undefined) {
                return null;
            }

            const escaped = css
                .replace(/\\/g, "\\\\")
                .replace(/`/g, "\\`")
                .replace(/\$/g, "\\$");

            return {
                code: `export const cssSource = \`${escaped}\`;`,
                map: { mappings: "" },
            };
        },
    };
}

function emptyLoaderCssPlugin() {
    return {
        name: "empty-loader-css",
        generateBundle(this: {
            emitFile: (file: {
                type: "asset";
                fileName: string;
                source: string;
            }) => void;
        }) {
            this.emitFile({
                type: "asset",
                fileName: "loader.css",
                source: "",
            });
        },
    };
}

const preactJsxRuntime = new URL(
    import.meta.resolve("preact/jsx-runtime")
).pathname;

const preactCompatAlias: Record<string, string> = {
    react: "preact/compat",
    "react-dom": "preact/compat",
    "react/jsx-runtime": "preact/jsx-runtime",
    "react/jsx-dev-runtime": "preact/jsx-runtime",
    "preact/jsx-runtime": preactJsxRuntime,
};

export default defineConfig([
    {
        entry: {
            buttonShare: "./src/components/ButtonShare/index.ts",
            buttonWallet: "./src/components/ButtonWallet/index.ts",
            openInApp: "./src/components/OpenInAppButton/index.ts",
            postPurchase: "./src/components/PostPurchase/index.ts",
            banner: "./src/components/Banner/index.ts",
        },
        format: ["esm"],
        platform: "browser",
        target: "es2022",
        clean: true,
        dts: true,
        outDir: "./dist",
        alias: preactCompatAlias,
        deps: { alwaysBundle: [/design-system/] },
        plugins: [vanillaExtractInlinePlugin(), nodePolyfills()],
    },
    {
        entry: {
            components: "./src/components.ts",
            loader: "./src/utils/loader.ts",
        },
        format: "esm",
        platform: "browser",
        target: "es2022",
        clean: true,
        minify: true,
        dts: false,
        outDir: "./cdn",
        deps: { alwaysBundle: [/.*/] },
        alias: preactCompatAlias,
        treeshake: {
            moduleSideEffects: true,
        },
        define: {
            "process.env.BACKEND_URL": JSON.stringify(
                process.env.BACKEND_URL || "https://backend.frak.id"
            ),
            "process.env.BUILD_TIMESTAMP": JSON.stringify(Date.now()),
            "process.env.CDN_TAG": JSON.stringify(
                process.env.CDN_TAG || "latest"
            ),
        },
        outputOptions(options) {
            return {
                ...options,
                entryFileNames: "[name].js",
                chunkFileNames: "[name].[hash].js",
            };
        },
        plugins: [
            vanillaExtractInlinePlugin(),
            nodePolyfills(),
            emptyLoaderCssPlugin(),
        ],
    },
]);
