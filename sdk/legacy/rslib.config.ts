import { defineConfig } from "@rslib/core";
import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";

export default defineConfig({
    lib: [
        {
            format: "umd",
            syntax: "es2022",
            umdName: "NexusSDK",
            source: {
                entry: {
                    index: "./src/bundle.ts",
                },
            },
            output: {
                filename: {
                    js: "bundle.js",
                },
                distPath: {
                    root: "./dist/bundle",
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
    tools: {
        rspack: {
            plugins: [new TsCheckerRspackPlugin()],
        },
    },
});
