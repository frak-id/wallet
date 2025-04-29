import type { LoggingFunction, RollupLog } from "rollup";

/**
 * Built from a bundle:check and the dependency graph:
 *  - https://npmgraph.js.org/?q=https://raw.githubusercontent.com/frak-id/wallet/refs/heads/dev/packages/wallet/package.json
 *
 * Try to mimic a granular chunking approach: https://web.dev/articles/granular-chunking-nextjs (but manually)
 */
const multipleLibsFromKey = {
    "blockchain-libs": [
        // app essentials
        "app-essentials/src/blockchain/wallet.ts",
        "app-essentials/src/blockchain/index.ts",
        // top level libs
        "node_modules/viem",
        "node_modules/wagmi",
        "node_modules/@wagmi",
        "node_modules/ox",
        "node_modules/permissionless",
        // dependency
        "node_modules/use-sync-external-store",
        "node_modules/@scure",
        "node_modules/abitype",
        "node_modules/zustand", // <- to move out if we start to use it globally
        "node_modules/mipd",
        "node_modules/elliptic",
        "node_modules/readable-stream",
    ],
    webauthn: [
        // Lib used to parse webauthn signature
        "node_modules/@peculiar",
        "node_modules/tiny-cbor",
        "node_modules/@evischuck/tiny-cbor",
        "node_modules/hexagon",
        "node_modules/asn1.js",
        "node_modules/asn1js",
        "node_modules/pvutils",
        "node_modules/pvtsutils",
        "node_modules/cbor",
        // Generic lib to check / generate webauthn signature
        "node_modules/@simplewebauthn",
    ],
    polyfill: [
        "node_modules/vite-plugin-node-polyfills",
        "node_modules/browserify-rsa",
        "node_modules/browserify-sign",
        "node_modules/core-js",
    ],
    ui: [
        "node_modules/@radix-ui",
        "node_modules/vaul",
        "node_modules/react-hook-form",
        "node_modules/lucide-react",
        "node_modules/react-dropzone",
        "node_modules/file-selector",
        "node_modules/@floating-ui",
        "node_modules/nprogress",
        "node_modules/micromark",
        "node_modules/i18next",
        "node_modules/cuer",
        "node_modules/qr",
        "node_modules/@lottiefiles",
    ],
    // state: ["@tanstack", "ky", "jotai", "@jsonjoy", "dexie"],
    react: [
        "node_modules/react",
        "node_modules/react-dom",
        "node_modules/react-router",
    ],
};

export function manualChunks(id: string) {
    // todo: temp just for testing
    if (id.includes("app-essentials")) return "app-essentials";
    if (id.includes("node_modules")) return "vendor";
    return;

    // Check if that's in the multiple libs bundle
    for (const [key, libs] of Object.entries(multipleLibsFromKey)) {
        if (libs.find((lib) => id.includes(lib))) {
            return key;
        }
    }

    // Otherwise, if that's a node module, return vendor
    if (id.includes("node_modules")) return "vendor";

    // All the stuff remaining should be the app
    // return "app";
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
