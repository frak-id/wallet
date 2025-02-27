import { pluginPreact } from "@rsbuild/plugin-preact";
import { pluginSvgr } from "@rsbuild/plugin-svgr";
import { type LibConfig, defineConfig } from "@rslib/core";
import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";

function createLibConfig(config: LibConfig = {}): LibConfig {
    const basicConfig: LibConfig = {
        syntax: "es2022",
        dts: {
            bundle: false,
            autoExtension: true,
        },
        source: {
            entry: {
                index: "./src/index.ts",
                buttonShare: "./src/components/ButtonShare/index.ts",
                buttonWallet: "./src/components/ButtonWallet/index.ts",
            },
        },
        output: {
            distPath: {
                root: "./dist/components",
            },
        },
    };

    return {
        ...basicConfig,
        ...config,
    };
}

export default defineConfig({
    lib: [
        createLibConfig({
            format: "esm",
        }),
        createLibConfig({
            format: "cjs",
        }),
        {
            format: "umd",
            syntax: "es2022",
            umdName: "FrakComponents",
            source: {
                entry: {
                    index: "./src/components.ts",
                },
            },
            output: {
                distPath: {
                    root: "./cdn",
                },
                filename: {
                    js: "components.js",
                    css: "components.css",
                },
            },
        },
    ],
    mode: "production",
    output: {
        target: "web",
        minify: true,
        cleanDistPath: true,
    },
    plugins: [
        pluginPreact(),
        pluginSvgr({
            svgrOptions: {
                exportType: "default",
            },
        }),
    ],
    tools: {
        rspack: {
            plugins: [new TsCheckerRspackPlugin()],
        },
    },
});
