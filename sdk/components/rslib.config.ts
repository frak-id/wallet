import { pluginPreact } from "@rsbuild/plugin-preact";
import { pluginSvgr } from "@rsbuild/plugin-svgr";
import { defineConfig } from "@rslib/core";
import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";

export default defineConfig({
    lib: [
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
