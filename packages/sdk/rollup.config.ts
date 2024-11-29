import resolve from "@rollup/plugin-node-resolve";
// import replace from "@rollup/plugin-replace";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import { defineConfig } from "rollup";
import summary from "rollup-plugin-summary";

// @ts-ignore
export default defineConfig({
    plugins: [
        // replace({
        //     preventAssignment: true,
        //     values: {
        //         "process.env.FRAK_WALLET_URL": JSON.stringify(
        //             Resource.FRAK_WALLET_URL
        //         ),
        //     },
        // }),
        // Resolve bare module specifiers to relative paths
        resolve(),
        typescript({
            tsconfig: "tsconfig.json",
            sourceMap: false,
        }),
        // Minify JS
        terser({
            ecma: 2021,
            module: true,
        }),
        // Print bundle summary
        summary(),
    ],
    input: "./src/components/bootstrap.ts",
    output: {
        file: "./dist/components/bootstrap.js",
        format: "iife",
        sourcemap: false,
        name: "FrakComponents",
    },
});
