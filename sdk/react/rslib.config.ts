import { pluginReact } from "@rsbuild/plugin-react";
import { type LibConfig, defineConfig } from "@rslib/core";
import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";

function createLibConfig(config: LibConfig = {}): LibConfig {
    const basicConfig: LibConfig = {
        syntax: "es2022",
        dts: {
            bundle: true,
            autoExtension: true,
        },
        source: {
            entry: {
                index: "./src/index.ts",
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
    ],
    mode: "production",
    output: {
        target: "web",
        minify: true,
        cleanDistPath: true,
    },
    plugins: [pluginReact()],
    tools: {
        rspack: {
            plugins: [new TsCheckerRspackPlugin()],
        },
    },
});
