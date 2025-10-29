import type { LoggingFunction, ManualChunkMeta, RollupLog } from "rollup";

/**
 * Vendor chunking strategy optimized to reduce entry.client bundle size
 *
 * Performance rationale:
 * - Separating vendors prevents app code changes from invalidating large vendor caches
 * - Grouping by usage pattern enables better browser caching
 * - Each chunk is sized to maximize parallel download benefit vs HTTP/2 multiplexing overhead
 *
 * Chunk strategy:
 * - vendor1: UI libraries (modal, dropdowns, forms) - used across most routes
 * - vendor2: Blockchain libraries (viem, webauthn) - heavy, used in wallet operations
 * - vendor3: i18n + shared UI - loaded early, rarely changes
 * - vendor4: React Query + TanStack libs - data fetching, used everywhere
 * - vendor: Catch-all for other node_modules
 *
 * Target: Keep each vendor chunk < 150KB gzipped for optimal mobile performance
 */
const vendorChunks = {
    // Generic UI related chunks (~70KB gzipped)
    1: [
        "node_modules/vaul",
        "node_modules/@radix-ui",
        "node_modules/micromark",
        "node_modules/lucide-react",
        "node_modules/cuer",
        "nprogress",
        "node_modules/react-hook-form",
        "node_modules/react-dropzone",
    ],
    // Blockchain related chunks (~130KB gzipped)
    2: [
        "node_modules/viem",
        "node_modules/ox",
        "node_modules/permissionless",
        "node_modules/@simplewebauthn",
        "node_modules/@peculiar",
        "node_modules/@noble",
        "node_modules/@scure",
    ],
    // Translation + shared ui (~70KB gzipped)
    3: ["i18next", "packages/ui"],
};

// Define the app packages
const appPackages = [
    "packages/app-essentials",
    "packages/wallet-shared",
    "apps/wallet",
    "apps/listener",
    "frak-wallet/sdk/core",
];

// Package that we shouldn't handle, and let the rollup compiler find the ideal place for them
const unhandledPackages = [
    "vite",
    "node_modules/react-dom/",
    "node_modules/react-router/",
];

/**
 * Create some manual chunks
 *  -> The check order should be as follow -> unhandled -> listener -> app -> vendorChunks -> vendor
 *
 * If no primary match found, check for potentially sub vendor lib (if also used on app or unhandled it will be placed in the general vendor chunk)
 */
export function manualChunks(id: string, meta: ManualChunkMeta) {
    // if (id.includes("listener")) {
    //     console.log("listener", id);
    // }

    // If the package is in the unhandled packages, return undefined
    if (unhandledPackages.find((pkg) => id.includes(pkg))) {
        return undefined;
    }

    // Early exit on some specific app packages
    if (appPackages.find((pkg) => id.includes(pkg))) {
        return "app";
    }

    // Check if that's id is in our predefined list
    for (const [key, libs] of Object.entries(vendorChunks)) {
        if (libs.find((lib) => id.includes(lib))) {
            return `vendor${key}`;
        }
    }

    // Otherwise, try to find a specific (checking the importer of this id recursively)
    const vendorChunk = findVendorChunk(id, meta);
    if (vendorChunk?.startsWith("vendor")) {
        return vendorChunk;
    }

    // If we didn't find a valid vendor chunk, return the regular chunk
    return "vendor";
}

/**
 * Recursively find the importer package key
 */
function findVendorChunk(
    id: string,
    meta: ManualChunkMeta,
    iterations?: number
): string | undefined | null {
    const info = meta.getModuleInfo(id);
    const importers = info?.importers;
    if (
        // If entrypoint, or too many iterations, return null
        info?.isEntry ||
        (iterations ?? 0) > 5 ||
        // If no importers, or too many importers, return null
        !importers ||
        importers.length > 15
    ) {
        return null;
    }

    // Iterate over each imports
    const packages = importers
        .map((importer) => {
            // If the package is in the unhandled packages, return undefined
            if (unhandledPackages.find((pkg) => importer.includes(pkg))) {
                return undefined;
            }

            // If the root package is in the app packages, return "app"
            if (appPackages.find((pkg) => importer.includes(pkg))) {
                return "app";
            }

            // Try to find a matching vendor chunk
            for (const [key, libs] of Object.entries(vendorChunks)) {
                if (libs.find((lib) => importer.includes(lib))) {
                    return `vendor${key}`;
                }
            }

            // Recursively find the importer package
            const recursiveImporter = findVendorChunk(
                importer,
                meta,
                (iterations ?? 0) + 1
            );
            if (recursiveImporter) {
                return recursiveImporter;
            }

            return undefined;
        })
        .filter(Boolean);

    if (packages.length === 0) {
        return undefined;
    }

    // Get the unique packages found
    const uniquePackages = new Set(packages);
    if (uniquePackages.size > 1) {
        console.log(
            `Found multiple importer packages for ${id}: ${Array.from(uniquePackages).join(", ")}`
        );
        return undefined;
    }

    // Return the first package if there is one
    return Array.from(uniquePackages)[0];
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
