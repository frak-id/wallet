/** @type {Partial<import("typedoc").TypeDocOptions>} */
const config = {
    plugin: ["typedoc-plugin-markdown", "typedoc-plugin-inline-sources"],
    entryPoints: ["sdk/core", "sdk/react"],
    entryPointStrategy: "packages",
    packageOptions: {
        entryPoints: [
            // top level entry points,
            "src/index.ts",
            // Core SDK custom entry points
            "src/actions/index.ts",
            "src/interactions/index.ts",
        ],
    },
    out: "./generated-docs",
    fileExtension: ".mdx",
    // Module is too fat, and members too verbose, should find a mix
    outputFileStrategy: "members",
    excludeScopesInPaths: true,
    excludeInternal: true,
    // Stylisation
    // If set to true, should use @link in the comment to reference param types and stuff
    useCodeBlocks: false,
    expandObjects: true,
    expandParameters: true,
    typeDeclarationVisibility: "compact",
};

export default config;
