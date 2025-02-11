import { pluginReact } from "@rsbuild/plugin-react";
import { defineConfig } from "@rslib/core";
import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";

const createEntryConfigs = (format: "esm" | "cjs") => [
    {
        format,
        syntax: "es2022" as const,
        dts: {
            bundle: true,
            autoExtension: true,
        },
        source: {
            entry: {
                index: "./src/index.ts",
            },
        },
    },
];

export default defineConfig({
    lib: [...createEntryConfigs("esm"), ...createEntryConfigs("cjs")],
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
