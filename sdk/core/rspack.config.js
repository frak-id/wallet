import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";

const createConfig = (format) => {
    const isESM = format === "esm";
    // const isCJS = format === "cjs";
    const isIIFE = format === "iife";

    /** @type {import('@rspack/cli').Configuration} */
    return {
        entry: isIIFE
            ? "./src/bundle.ts"
            : {
                  index: "./src/index.ts",
                  actions: "./src/actions/index.ts",
                  interactions: "./src/interactions/index.ts",
              },
        plugins: [new TsCheckerRspackPlugin()],
        mode: "production",
        devtool: false,
        target: "web",
        module: {
            rules: [
                {
                    test: /\.ts?$/,
                    exclude: /node_modules/,
                    loader: "builtin:swc-loader",
                    options: {
                        sourceMap: false,
                        jsc: {
                            parser: {
                                syntax: "typescript",
                            },
                            target: "es2022",
                        },
                    },
                    type: "javascript/auto",
                },
            ],
        },
        resolve: {
            extensions: [".ts", ".tsx", ".js", ".jsx"],
        },
        optimization: {
            minimize: true,
        },
        output: {
            path: `dist/${format}`,
            filename: "[name].js",
            library: isIIFE
                ? { name: "FrakSetup", type: "window" }
                : { type: isESM ? "module" : "commonjs2" },
            module: isESM,
            environment: isESM ? { module: true } : undefined,
            chunkFormat: isESM ? "module" : "commonjs",
        },
        ...(isESM && {
            experiments: {
                outputModule: true,
            },
        }),
    };
};

// Export multiple configurations
export default ["esm", "cjs", "iife"].map(createConfig);
