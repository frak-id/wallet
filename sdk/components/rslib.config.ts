import { pluginPreact } from "@rsbuild/plugin-preact";
import { pluginSvgr } from "@rsbuild/plugin-svgr";
import { type LibConfig, defineConfig } from "@rslib/core";
import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";

/**
 * Create the lib config for NPM distribution
 * @returns The lib config
 */
function createNPMConfig(): LibConfig {
    return {
        id: "npm",
        format: "esm",
        syntax: "es2022",
        dts: {
            bundle: true,
            autoExtension: true,
        },
        source: {
            entry: {
                buttonShare: "./src/components/ButtonShare/index.ts",
                buttonWallet: "./src/components/ButtonWallet/index.ts",
            },
        },
    };
}

/**
 * Create the lib config for CDN distribution
 * @returns The lib config
 */
function createCDNConfig(): LibConfig {
    return {
        id: "cdn",
        format: "esm",
        syntax: "es2022",
        autoExternal: {
            // We don't want to auto-externalize dependencies
            dependencies: false,
        },
        source: {
            entry: {
                components: "./src/components.ts",
            },
        },
        output: {
            distPath: {
                root: "./cdn",
            },
            filename: {
                js: "[name].[contenthash:8].js",
                css: "[name].[contenthash:8].css",
            },
        },
        performance: {
            chunkSplit: {
                strategy: "custom",
                splitChunks: {
                    cacheGroups: {
                        preact: {
                            test: /preact/,
                            name: "preact",
                            chunks: "all",
                            enforce: true,
                            reuseExistingChunk: true,
                        },
                        sha256: {
                            test: require.resolve("js-sha256"),
                            name: "js-sha256",
                            chunks: "all",
                            enforce: true,
                            reuseExistingChunk: true,
                        },
                    },
                },
            },
        },
    };
}
export default defineConfig({
    lib: [createNPMConfig(), createCDNConfig()],
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
