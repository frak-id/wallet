/** @type {Partial<import("typedoc").TypeDocOptions>} */
const config = {
    plugin: ["typedoc-plugin-markdown"],
    entryPoints: ["sdk/*"],
    entryPointStrategy: "packages",
    packageOptions: {
        entryPoints: [
            // top level entry points,
            "src/index.ts",
            "src/components.ts",
            "src/bundle.ts",
            // Core SDK custom entry points
            "src/actions/index.ts",
            "src/interactions/index.ts",
        ],
    },
    out: "./docs-tmp",
};

export default config;
