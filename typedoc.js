/** @type {Partial<import("typedoc").TypeDocOptions>} */
const config = {
    plugin: [
        // Generate markdown output
        "typedoc-plugin-markdown",
        // Options to add `@source` tag in tsdoc, to include the source code in the out file
        "typedoc-plugin-inline-sources",
        // Add frontmatter headers to mdx file
        "typedoc-plugin-frontmatter",
        // Custom scripts (frontmatter + vocs sidebar generation)
        "./docs/vocs-frontmatter.js",
        "./docs/vocs-sidebar.js",
    ],
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
    out: "./generated-docs/",
    fileExtension: ".mdx",
    // Module is too fat, and members too verbose, should find a mix
    outputFileStrategy: "members",
    excludeScopesInPaths: true,
    excludeExternals: true,
    categorizeByGroup: true,
    // Tell that this will be in a subfolder of the main docs
    publicPath: "/wallet-sdk/references",
    // Stylisation
    // If set to true, should use @link in the comment to reference param types and stuff
    useCodeBlocks: false,
    expandObjects: true,
    expandParameters: true,
    typeDeclarationVisibility: "verbose",
    // Frontmatter
    frontmatterCommentTags: ["description"],
};

export default config;
