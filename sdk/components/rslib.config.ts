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
                loader: "./src/utils/loader.ts",
            },
        },
        output: {
            distPath: {
                root: "./cdn",
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
