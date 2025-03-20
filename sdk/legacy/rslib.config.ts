import { tools } from "@frak-labs/shared/tooling/rslib";
import { defineConfig } from "@rslib/core";

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
        ...tools,
    },
});
