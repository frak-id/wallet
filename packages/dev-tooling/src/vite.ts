import type { LoggingFunction, RollupLog } from "rollup";

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

/**
 * Shared Lightning CSS configuration for all Vite-based apps in the monorepo.
 * Provides consistent CSS processing with optimal performance and modern features.
 *
 * @example
 * ```ts
 * import { lightningCssConfig } from "@frak-labs/dev-tooling";
 *
 * export default defineConfig({
 *   css: lightningCssConfig,
 * });
 * ```
 */
export const lightningCssConfig = {
    transformer: "lightningcss" as const,
    lightningcss: {
        /**
         * CSS Modules configuration
         * - dashedIdents: false -> Use camelCase for class names (e.g., .my-class -> styles.myClass)
         */
        cssModules: {
            dashedIdents: false,
        },
        /**
         * Browser targets aligned with "baseline-widely-available"
         * Ensures broad compatibility while enabling modern CSS features
         */
        targets: {
            chrome: 100,
            edge: 100,
            firefox: 91,
            safari: 14,
        },
        /**
         * Enable modern CSS draft features
         * - nesting: Native CSS nesting support (replaces postcss-preset-env)
         * - customMedia: Custom media queries (@custom-media)
         */
        drafts: {
            nesting: true,
            customMedia: true,
        },
    },
};
