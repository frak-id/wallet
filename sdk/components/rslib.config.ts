import { defineConfig } from "@rslib/core";
import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";

export default defineConfig({
    lib: [
        {
            format: "umd",
            syntax: "es2022",
            dts: false,
            umdName: "FrakComponents",
            source: {
                entry: {
                    index: "./src/components.ts",
                },
            },
            output: {
                polyfill: "usage",
                distPath: {
                    root: "./cdn",
                },
                filename: {
                    js: "components.js",
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
