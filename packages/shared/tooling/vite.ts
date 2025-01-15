import type { LoggingFunction, RollupLog } from "rollup";

const hugeLibraries = [
    "viem",
    "dexie",
    "vite-plugin-node-polyfills",
    "readable-stream",
    "browserify-rsa",
    "browserify-sign",
    "elliptic",
    "@lottiefiles",
];

export function manualChunks(id: string) {
    const lib = hugeLibraries.find((lib) => id.includes(`node_modules/${lib}`));
    if (lib) return lib;
}

export function onwarn(warning: RollupLog, warn: LoggingFunction) {
    /**
     * Hide warnings about invalid annotations
     * ../../node_modules/ox/_esm/core/Json.js (1:21): A comment
     * "/*#__PURE__/"
     * in "../../node_modules/ox/_esm/core/Json.js" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
     */
    if (
        warning.code === "INVALID_ANNOTATION" &&
        warning.url?.includes("#pure")
    ) {
        // Ignore the warning
        return;
    }
    warn(warning); // Log other warnings
}
