import { defineConfig } from "@rslib/core";
import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";

const entries = {
    index: "./src/index.ts",
    actions: "./src/actions/index.ts",
    interactions: "./src/interactions/index.ts",
};

const createEntryConfigs = (format: "esm" | "cjs") =>
    Object.entries(entries).map(([name, path]) => ({
        id: `${name}:${format}`,
        format,
        syntax: "es2022" as const,
        dts: {
            bundle: true,
            autoExtension: true,
        },
        source: {
            entry: {
                [name]: path,
            },
        },
    }));

export default defineConfig({
    lib: [
        {
            id: "bundle",
            format: "umd",
            syntax: "es2022",
            umdName: "FrakSDK",
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
                    root: "./cdn",
                },
            },
        },
        ...createEntryConfigs("esm"),
        ...createEntryConfigs("cjs"),
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
