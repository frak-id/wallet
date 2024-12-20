import { defineConfig } from "@rslib/core";
import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";

export default defineConfig({
    lib: [
        {
            format: "umd",
            syntax: "es2022",
            dts: false,
            umdName: "FrakSDK",
            source: {
                entry: {
                    index: "./src/bundle.ts",
                },
            },
            output: {
                distPath: {
                    root: "./cdn",
                },
            },
        },
        {
            format: "esm",
            syntax: "es2022",
            dts: {
                bundle: false,
                autoExtension: true,
                distPath: "./dist/types/esm",
            },
            source: {
                entry: {
                    index: "./src/index.ts",
                    actions: "./src/actions/index.ts",
                    interactions: "./src/interactions/index.ts",
                },
            },
        },
        {
            format: "cjs",
            syntax: "es2022",
            dts: {
                bundle: false,
                autoExtension: true,
                distPath: "./dist/types/cjs",
            },
            source: {
                entry: {
                    index: "./src/index.ts",
                    actions: "./src/actions/index.ts",
                    interactions: "./src/interactions/index.ts",
                },
            },
        },
    ],
    mode: "production",
    output: {
        minify: true,
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js", ".jsx"],
    },
    tools: {
        rspack: {
            plugins: [new TsCheckerRspackPlugin()],
        },
    },
});
