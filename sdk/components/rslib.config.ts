import { tools } from "@frak-labs/dev-tooling/rslib";
import { pluginPreact } from "@rsbuild/plugin-preact";
import { pluginSvgr } from "@rsbuild/plugin-svgr";
import { type LibConfig, defineConfig } from "@rslib/core";

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
            filenameHash: true,
            distPath: {
                root: "./cdn",
            },
        },
        tools: {
            rspack: {
                output: {
                    filename: (pathData) => {
                        // Only for the components and loader chunks, we want to use the original name
                        if (
                            pathData.chunk?.name === "components" ||
                            pathData.chunk?.name === "loader"
                        ) {
                            return "[name].js";
                        }
                        return "[name].[contenthash:8].js";
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
        ...tools,
    },
    source: {
        define: {
            "process.env.BUILD_TIMESTAMP": JSON.stringify(Date.now()),
        },
    },
});
