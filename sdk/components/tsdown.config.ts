import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
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
import {
    extractExpectedTags,
    findMissingRegistrations,
} from "./src/buildGuards/componentRegistrations.ts";

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
            //
            // Exception: reset/theme/sprinkles CSS is injected ONCE globally
            // via `sharedBaseCss.css.ts` (see loader.ts and useLightDomStyles).
            // For every OTHER source file, those imports are dropped here so
            // each component's <style> tag only contains component-specific
            // rules and we never re-emit ~28KB of shared rules per component
            // (which previously caused cascade-ordering bugs across <style>
            // tags when components mounted in certain orders).
            const isSharedBaseFile = filePath.endsWith("/sharedBaseCss.css.ts");
            const sharedCssRe =
                /\/(reset|theme|sprinkles|sharedBaseCss)\.css\.ts\.vanilla\.css/;
            let counter = 0;
            const cssImportNames: string[] = [];
            const rewritten = output
                .replace(/export (?:const|var|let) cssSource[^;]*;/g, "")
                .replace(
                    /import ['"]([^'"]+\.vanilla\.css[^'"]*)['"];?/g,
                    (_match, specifier) => {
                        if (!isSharedBaseFile && sharedCssRe.test(specifier)) {
                            return "";
                        }
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

/**
 * Fail the build when a component's `customElements.define` is missing from the
 * emitted output.
 *
 * The registration lives in a side-effect-only module, so a bundler that
 * believes the package is side-effect-free drops it — and the failure is
 * invisible, since undefined elements are hidden by the loader's own FOUCE
 * rule. The unit suite runs against `src`, where the call is intact, so only a
 * check on the artifact catches it. See
 * `src/buildGuards/componentRegistrations.ts`.
 */
function assertComponentRegistrations(): Plugin {
    return {
        name: "frak:assert-component-registrations",
        async writeBundle(
            outputOptions: { dir?: string },
            bundle: Record<string, { type: string; code?: string }>
        ) {
            const componentIndexes = await readdir(
                new URL("./src/components", import.meta.url),
                { withFileTypes: true }
            );

            const expectedTags: string[] = [];
            for (const entry of componentIndexes) {
                if (!entry.isDirectory()) continue;
                const indexPath = new URL(
                    `./src/components/${entry.name}/index.ts`,
                    import.meta.url
                );
                const source = await readFile(indexPath, "utf-8").catch(
                    () => ""
                );
                expectedTags.push(...extractExpectedTags(source));
            }

            if (expectedTags.length === 0) {
                throw new Error(
                    "[assert-component-registrations] No registerWebComponent() call found in src/components/*/index.ts — the guard cannot verify the bundle."
                );
            }

            const chunks = Object.values(bundle)
                .filter((output) => output.type === "chunk")
                .map((output) => output.code ?? "");

            const missing = findMissingRegistrations(expectedTags, chunks);
            if (missing.length > 0) {
                throw new Error(
                    `[assert-component-registrations] ${missing.length} component(s) are never registered in ${outputOptions.dir}: ${missing.join(", ")}.\n` +
                        "customElements.define will never run for them, and the loader's FOUCE rule hides undefined elements, so they will silently render nothing.\n" +
                        "Most likely cause: a `sideEffects` entry in package.json no longer covers the component entrypoints."
                );
            }

            console.log(
                `[assert-component-registrations] ${expectedTags.length} component registrations present in ${outputOptions.dir}`
            );
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

const preactJsxRuntime = new URL(import.meta.resolve("preact/jsx-runtime"))
    .pathname;

const preactCompatAlias: Record<string, string> = {
    react: "preact/compat",
    "react-dom": "preact/compat",
    "react/jsx-runtime": "preact/jsx-runtime",
    "react/jsx-dev-runtime": "preact/jsx-runtime",
    "preact/jsx-runtime": preactJsxRuntime,
};

// Stub rrweb in the CDN bundle only. @openpanel/web 1.4.1 dynamically imports
// its replay module (which depends on rrweb), but the CDN config bundles every
// dependency inline (`alwaysBundle: [/.*/]`), so we alias rrweb to a noop to
// keep that bundle small. The NPM build leaves the dynamic import alone so
// downstream bundlers can tree-shake / code-split it.
const rrwebStub = fileURLToPath(
    new URL("../core/src/stubs/rrweb.ts", import.meta.url)
);

export default defineConfig([
    {
        entry: {
            buttonShare: "./src/components/ButtonShare/index.ts",
            buttonWallet: "./src/components/ButtonWallet/index.ts",
            openInApp: "./src/components/OpenInAppButton/index.ts",
            postPurchase: "./src/components/PostPurchase/index.ts",
            banner: "./src/components/Banner/index.ts",
            "i18n/defaults": "./src/i18n/defaults.ts",
        },
        format: ["esm"],
        platform: "browser",
        target: "es2022",
        clean: true,
        dts: true,
        outDir: "./dist",
        alias: preactCompatAlias,
        deps: { alwaysBundle: [/design-system/, /rewards/] },
        plugins: [
            vanillaExtractInlinePlugin(),
            nodePolyfills(),
            assertComponentRegistrations(),
        ],
    },
    {
        entry: {
            components: "./src/components.ts",
            loader: "./src/bootstrap/loader.ts",
        },
        format: "esm",
        platform: "browser",
        target: "es2022",
        clean: true,
        minify:
            process.env.STAGE === "production"
                ? { compress: { dropConsole: true } }
                : true,
        dts: false,
        outDir: "./cdn",
        deps: { alwaysBundle: [/.*/] },
        alias: { ...preactCompatAlias, rrweb: rrwebStub },
        // NOTE: no `treeshake.moduleSideEffects` override here. The package
        // manifest's `sideEffects` allowlist is the single authority for what
        // may be shaken, and a blanket override would silently mask a manifest
        // that no longer covers the component entrypoints — which is exactly
        // how the registration calls were dropped from this bundle before.
        // `assertComponentRegistrations` fails the build if that regresses.
        define: {
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
            assertComponentRegistrations(),
        ],
    },
]);
